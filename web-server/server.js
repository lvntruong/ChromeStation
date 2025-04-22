const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const Docker = require('dockerode');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Khởi tạo Docker client
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const port = 3000;

// Store information about running containers
const activeSessions = {};

// Directory for Chrome profiles
const profilesDir = path.join(__dirname, 'chrome-profiles');

// Ensure profiles directory exists
if (!fs.existsSync(profilesDir)) {
  fs.mkdirSync(profilesDir, { recursive: true });
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Admin route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// API to list available profiles
app.get('/profiles', (req, res) => {
  try {
    const profiles = fs.readdirSync(profilesDir)
      .filter(file => fs.statSync(path.join(profilesDir, file)).isDirectory())
      .map(profile => ({
        name: profile,
        path: path.join(profilesDir, profile)
      }));
    
    res.json({ profiles });
  } catch (error) {
    console.error(`Error listing profiles: ${error.message}`);
    res.status(500).json({ error: 'Failed to list profiles' });
  }
});

// API to start a new Chrome session
app.get('/start-session', async (req, res) => {
  const sessionId = uuidv4();
  const containerPort = 6080 + Object.keys(activeSessions).length;
  const profileName = req.query.profile || 'default';
  
  // Check if profile exists, if not use default
  const profilePath = path.join(profilesDir, profileName);
  if (!fs.existsSync(profilePath)) {
    fs.mkdirSync(profilePath, { recursive: true });
  }
  
  try {
    // Determine the absolute host path for Docker volume mounting
    const absProfilePath = path.resolve(profilePath);
    
    // For Docker Desktop on Mac/Windows, we need to convert paths
    // See if we're on macOS or Windows
    const isWin = os.platform() === 'win32';
    const isMac = os.platform() === 'darwin';
    
    let bindPath;
    if (isMac) {
      // For Mac: use /Users/path instead of /app/path
      const homePath = os.homedir();
      if (absProfilePath.includes('/app/')) {
        bindPath = absProfilePath.replace('/app/', `${homePath}/`);
      } else {
        // Try to create a valid path
        bindPath = absProfilePath;
      }
    } else if (isWin) {
      // For Windows: convert C:\path to /c/path
      bindPath = absProfilePath.replace(/^([A-Z]):/, (_, drive) => `/${drive.toLowerCase()}`);
      bindPath = bindPath.replace(/\\/g, '/');
    } else {
      // Linux
      bindPath = absProfilePath;
    }
    
    console.log(`Profile path: ${profilePath}`);
    console.log(`Absolute profile path: ${absProfilePath}`);
    console.log(`Binding path for Docker: ${bindPath}`);
    
    // Debugging info
    console.log(`Platform: ${os.platform()}`);
    console.log(`Home directory: ${os.homedir()}`);
    
    // Create a simple volume mount test to verify binding
    try {
      fs.writeFileSync(path.join(profilePath, 'test.txt'), 'Testing volume mount');
      console.log(`Created test file in ${path.join(profilePath, 'test.txt')}`);
    } catch (err) {
      console.error(`Error creating test file: ${err.message}`);
    }
    
    // Create and start container using Dockerode
    console.log(`Starting container with profile ${profileName} on port ${containerPort}`);
    
    const container = await docker.createContainer({
      Image: 'chrome-kiosk',
      name: `chrome-session-${sessionId}`,
      Hostname: `chrome-session-${sessionId}`,
      ExposedPorts: {
        '6080/tcp': {}
      },
      Env: [
        "DISPLAY=:99",
        "RESOLUTION=1280x720x24",
        "XDG_RUNTIME_DIR=/tmp/runtime-dir"
      ],
      HostConfig: {
        PortBindings: {
          '6080/tcp': [{ HostPort: `${containerPort}` }]
        },
        Binds: [`${bindPath}:/root/chrome-profile:rw`],
        Privileged: false,
        ReadonlyRootfs: false
      }
    });
    
    await container.start();
    
    // Get container info
    const containerInfo = await container.inspect();
    
    // Save container information
    activeSessions[sessionId] = {
      containerId: containerInfo.Id,
      port: containerPort,
      startTime: new Date(),
      profile: profileName
    };
    
    console.log(`Started new session: ${sessionId} on port ${containerPort} with profile ${profileName}`);
    res.json({ 
      sessionId, 
      port: containerPort, 
      profile: profileName 
    });
  } catch (error) {
    console.error(`Error starting container: ${error.message}`);
    res.status(500).json({ error: 'Failed to start session', details: error.message });
  }
});

// API to end a specific session
app.get('/end-session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  
  if (activeSessions[sessionId]) {
    try {
      await terminateSession(sessionId);
      res.json({ success: true, message: `Session ${sessionId} terminated` });
    } catch (error) {
      console.error(`Error terminating session: ${error.message}`);
      res.status(500).json({ error: 'Failed to terminate session', details: error.message });
    }
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

// API to create a new profile
app.post('/create-profile/:name', (req, res) => {
  const { name } = req.params;
  
  if (!name || name.includes('..') || name.includes('/')) {
    return res.status(400).json({ error: 'Invalid profile name' });
  }
  
  const profilePath = path.join(profilesDir, name);
  
  try {
    if (!fs.existsSync(profilePath)) {
      fs.mkdirSync(profilePath, { recursive: true });
      res.json({ success: true, message: `Profile ${name} created` });
    } else {
      res.status(409).json({ error: 'Profile already exists' });
    }
  } catch (error) {
    console.error(`Error creating profile: ${error.message}`);
    res.status(500).json({ error: 'Failed to create profile' });
  }
});

// API to duplicate a profile
app.get('/duplicate-profile', (req, res) => {
  const { source, target } = req.query;
  
  if (!source || !target) {
    return res.status(400).json({ error: 'Source and target profile names are required' });
  }
  
  if (target.includes('..') || target.includes('/')) {
    return res.status(400).json({ error: 'Invalid target profile name' });
  }
  
  const sourcePath = path.join(profilesDir, source);
  const targetPath = path.join(profilesDir, target);
  
  try {
    if (!fs.existsSync(sourcePath)) {
      return res.status(404).json({ error: 'Source profile does not exist' });
    }
    
    if (fs.existsSync(targetPath)) {
      return res.status(409).json({ error: 'Target profile already exists' });
    }
    
    // Create the target directory
    fs.mkdirSync(targetPath, { recursive: true });
    
    // Copy files from source to target
    copyFolderSync(sourcePath, targetPath);
    
    res.json({ success: true, message: `Profile ${source} duplicated to ${target}` });
  } catch (error) {
    console.error(`Error duplicating profile: ${error.message}`);
    res.status(500).json({ error: 'Failed to duplicate profile' });
  }
});

// Helper function to recursively copy a directory
function copyFolderSync(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  
  const files = fs.readdirSync(source);
  
  files.forEach(file => {
    const sourcePath = path.join(source, file);
    const targetPath = path.join(target, file);
    
    const stat = fs.statSync(sourcePath);
    
    if (stat.isDirectory()) {
      copyFolderSync(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  });
}

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('New client connected');
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Helper function to terminate a session using Dockerode
async function terminateSession(sessionId) {
  const session = activeSessions[sessionId];
  if (session) {
    try {
      const container = docker.getContainer(session.containerId);
      
      // Kiểm tra xem container có tồn tại không
      try {
        await container.inspect();
      } catch (error) {
        console.log(`Container for session ${sessionId} does not exist anymore, removing from active sessions.`);
        delete activeSessions[sessionId];
        return;
      }
      
      // Dừng và xóa container
      await container.stop({ t: 5 }); // 5 seconds timeout
      await container.remove({ force: true });
      
      console.log(`Session ${sessionId} terminated`);
      delete activeSessions[sessionId];
    } catch (error) {
      console.error(`Error terminating session ${sessionId}: ${error.message}`);
      // Vẫn xóa khỏi danh sách phiên ngay cả khi có lỗi để tránh các phiên "ma"
      delete activeSessions[sessionId];
    }
  }
}

// Automatic cleanup of inactive sessions (every 15 minutes)
setInterval(async () => {
  const now = new Date();
  
  for (const sessionId of Object.keys(activeSessions)) {
    const session = activeSessions[sessionId];
    const sessionAgeMinutes = (now - session.startTime) / (1000 * 60);
    
    // Cleanup sessions older than 60 minutes
    if (sessionAgeMinutes > 60) {
      console.log(`Auto-terminating inactive session ${sessionId} (age: ${sessionAgeMinutes.toFixed(0)} minutes)`);
      try {
        await terminateSession(sessionId);
      } catch (error) {
        console.error(`Error during auto-cleanup of session ${sessionId}: ${error.message}`);
      }
    }
  }
}, 15 * 60 * 1000); // 15 minutes

// Admin APIs
app.get('/admin/active-sessions', (req, res) => {
  res.json({ 
    activeSessions,
    count: Object.keys(activeSessions).length 
  });
});

app.get('/admin/cleanup-all', async (req, res) => {
  const sessionIds = Object.keys(activeSessions);
  
  try {
    // Xóa lần lượt từng phiên
    for (const sessionId of sessionIds) {
      try {
        await terminateSession(sessionId);
      } catch (error) {
        console.error(`Error terminating session ${sessionId}: ${error.message}`);
      }
    }
    
    res.json({ 
      message: 'Cleanup initiated',
      sessionsToClean: sessionIds.length
    });
  } catch (error) {
    console.error(`Error cleaning up all sessions: ${error.message}`);
    res.status(500).json({ error: 'Failed to clean up all sessions' });
  }
});

// Debug route to check Docker connection
app.get('/debug/docker', async (req, res) => {
  try {
    const info = await docker.info();
    const containers = await docker.listContainers();
    const version = await docker.version();
    
    res.json({
      info: info,
      containers: containers,
      version: version,
      platform: os.platform(),
      hostname: os.hostname(),
      profilesDir: profilesDir,
      profilesDirResolved: path.resolve(profilesDir)
    });
  } catch (error) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Start the server
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 