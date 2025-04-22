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

// Middleware để xử lý dữ liệu JSON trong body request
app.use(express.json());

// Khởi tạo Docker client
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const port = 3000;

// Store information about running containers
const activeSessions = {};

// Cấu hình thư mục profile trong container
const profilesDir = path.join(__dirname, 'chrome-profiles');
console.log(`Profile directory: ${profilesDir}`);

// Đối với môi trường Docker, cần xác định đường dẫn thật từ host
const hostProfilesDir = process.env.HOST_PROFILES_DIR || '/Users/dev/Documents/Mine/chrome-browser/chrome-profiles';

// Ensure profiles directory exists
if (!fs.existsSync(profilesDir)) {
  fs.mkdirSync(profilesDir, { recursive: true });
  console.log(`Created profiles directory: ${profilesDir}`);
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
      .map(profile => {
        const profilePath = path.join(profilesDir, profile);
        let defaultUrl = 'https://www.google.com.vn'; // URL mặc định
        
        // Đọc file config.json nếu có
        const configPath = path.join(profilePath, 'config.json');
        if (fs.existsSync(configPath)) {
          try {
            const configContent = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configContent);
            if (config.defaultUrl) {
              defaultUrl = config.defaultUrl;
            }
          } catch (err) {
            console.error(`Error reading profile config for ${profile}: ${err.message}`);
          }
        }
        
        return {
          name: profile,
          path: profilePath,
          defaultUrl: defaultUrl
        };
      });
    
    res.json({ profiles });
  } catch (error) {
    console.error(`Error listing profiles: ${error.message}`);
    res.status(500).json({ error: 'Failed to list profiles' });
  }
});

// API to start a new Chrome session
app.get('/start-session', async (req, res) => {
  const sessionId = uuidv4();
  const profileName = req.query.profile || 'default';
  
  // Check if profile exists, if not use default
  const profilePath = path.join(profilesDir, profileName);
  if (!fs.existsSync(profilePath)) {
    fs.mkdirSync(profilePath, { recursive: true });
    console.log(`Created profile directory: ${profilePath}`);
  }
  
  try {
    console.log(`Profile path for ${profileName}: ${profilePath}`);
    
    // Lấy URL mặc định của profile hoặc URL mặc định toàn cục
    let defaultUrl = 'https://www.google.com.vn'; // URL mặc định
    console.log(`[DEBUG] Starting with default URL: ${defaultUrl}`);
    
    // Đọc file config.json của profile
    const configPath = path.join(profilePath, 'config.json');
    console.log(`[DEBUG] Checking for config file at: ${configPath}`);
    console.log(`[DEBUG] Config file exists: ${fs.existsSync(configPath)}`);
    
    if (fs.existsSync(configPath)) {
      try {
        console.log(`[DEBUG] Reading config file...`);
        const configContent = fs.readFileSync(configPath, 'utf8');
        console.log(`[DEBUG] Config content: ${configContent}`);
        const config = JSON.parse(configContent);
        console.log(`[DEBUG] Parsed config:`, config);
        if (config.defaultUrl) {
          defaultUrl = config.defaultUrl;
          console.log(`[DEBUG] Found profile-specific URL: ${defaultUrl}`);
        } else {
          console.log(`[DEBUG] No defaultUrl found in profile config`);
        }
      } catch (err) {
        console.error(`[DEBUG] Error reading profile config: ${err.message}`);
      }
    }
    
    // Nếu không có URL mặc định của profile, lấy URL mặc định toàn cục
    if (defaultUrl === 'https://www.google.com.vn') {
      console.log(`[DEBUG] Using fallback. Checking global settings...`);
      const settingsPath = path.join(__dirname, 'settings.json');
      console.log(`[DEBUG] Settings file path: ${settingsPath}`);
      console.log(`[DEBUG] Settings file exists: ${fs.existsSync(settingsPath)}`);
      
      if (fs.existsSync(settingsPath)) {
        try {
          console.log(`[DEBUG] Reading settings file...`);
          const settingsContent = fs.readFileSync(settingsPath, 'utf8');
          console.log(`[DEBUG] Settings content: ${settingsContent}`);
          const settings = JSON.parse(settingsContent);
          console.log(`[DEBUG] Parsed settings:`, settings);
          if (settings.defaultUrl) {
            defaultUrl = settings.defaultUrl;
            console.log(`[DEBUG] Found global default URL: ${defaultUrl}`);
          } else {
            console.log(`[DEBUG] No defaultUrl found in global settings`);
          }
        } catch (err) {
          console.error(`[DEBUG] Error reading global settings: ${err.message}`);
        }
      }
    }
    
    console.log(`[DEBUG] Final URL for profile ${profileName}: ${defaultUrl}`);
    
    // Đảm bảo URL có định dạng đúng
    try {
      new URL(defaultUrl);
      console.log(`[DEBUG] URL is valid`);
    } catch (e) {
      console.log(`[DEBUG] URL invalid, falling back to google.com.vn`);
      defaultUrl = 'https://www.google.com.vn';
    }
    
    console.log(`Using default URL for profile ${profileName}: ${defaultUrl}`);
    
    // Create a simple volume mount test to verify binding
    try {
      fs.writeFileSync(path.join(profilePath, 'test.txt'), 'Testing volume mount');
      console.log(`Created test file in ${path.join(profilePath, 'test.txt')}`);
    } catch (err) {
      console.error(`Error creating test file: ${err.message}`);
    }
    
    // Tìm cổng trống để khởi động container
    let containerPort = 9080 + Object.keys(activeSessions).length;
    let maxAttempts = 100; // Giới hạn số lần thử
    let portFound = false;
    
    console.log(`Using profiles directory: ${hostProfilesDir}`);
    
    // Tạo container và xử lý lỗi port bị trùng
    while (!portFound && maxAttempts > 0) {
      try {
        console.log(`Trying to start container with profile ${profileName} on port ${containerPort}`);
        
        // Xác định nếu profile là admin thì sẽ cài đặt ADMIN_MODE=1
        const isAdmin = req.query.admin === 'true';
        console.log(`Starting session with admin mode: ${isAdmin ? 'YES' : 'NO'}`);
        
        const container = await docker.createContainer({
          Image: 'chrome-base',  // Sử dụng image chrome-base thay vì chrome-kiosk
          name: `chrome-session-${sessionId}`,
          Hostname: `chrome-session-${sessionId}`,
          ExposedPorts: {
            '8080/tcp': {}
          },
          Env: [
            "DISPLAY=:99",
            "RESOLUTION=1440x900x24",
            `ADMIN_MODE=${isAdmin ? '1' : '0'}`,
            `DEFAULT_URL=${defaultUrl}`
          ],
          HostConfig: {
            PortBindings: {
              '8080/tcp': [{ HostPort: `${containerPort}` }]
            },
            Binds: [
              `${hostProfilesDir}/${profileName}:/app/chrome-profiles/default:rw`
            ],
            NetworkMode: "chrome-browser_chrome-network",
            Privileged: false,
            ReadonlyRootfs: false
          }
        });
        
        await container.start();
        
        // Nếu không có lỗi, đánh dấu đã tìm thấy cổng
        portFound = true;
        
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
          profile: profileName,
          url: `http://${req.hostname}:${containerPort}/vnc.html?autoconnect=true&resize=scale&password=`
        });
        
      } catch (error) {
        if (error.message.includes('port is already allocated')) {
          // Nếu port đã bị chiếm, thử cổng tiếp theo
          console.log(`Port ${containerPort} is already in use. Trying next port.`);
          containerPort++;
          maxAttempts--;
        } else {
          // Nếu lỗi khác, ném lỗi để xử lý bên ngoài
          throw error;
        }
      }
    }
    
    // Nếu không tìm thấy cổng trống
    if (!portFound) {
      throw new Error(`Could not find available port after ${100 - maxAttempts} attempts`);
    }
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
      volumes: await docker.listVolumes()
    });
  } catch (error) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Admin session route
app.get('/admin/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  // Kiểm tra xem session có tồn tại không
  if (!activeSessions[sessionId]) {
    return res.redirect('/admin');
  }
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// User session route
app.get('/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  // Kiểm tra xem session có tồn tại không
  if (!activeSessions[sessionId]) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API tạo session admin với quyền đầy đủ
app.post('/api/admin/sessions', async (req, res) => {
  try {
    const profileName = req.body.profile || 'default';
    const adminKey = req.body.adminKey || '';
    
    // Kiểm tra xác thực admin key (nên sử dụng env var thực tế)
    const validAdminKey = process.env.ADMIN_KEY || 'admin-secret-key';
    
    if (adminKey !== validAdminKey) {
      return res.status(403).json({ error: 'Invalid admin key' });
    }
    
    // Kiểm tra và tạo thư mục profile nếu chưa tồn tại
    const profilePath = path.join(profilesDir, profileName);
    if (!fs.existsSync(profilePath)) {
      fs.mkdirSync(profilePath, { recursive: true });
      console.log(`Created profile directory for admin session: ${profilePath}`);
    }
    
    // Lấy URL mặc định của profile hoặc URL mặc định toàn cục
    let defaultUrl = 'https://www.google.com.vn'; // URL mặc định
    
    // Đọc file config.json của profile
    const configPath = path.join(profilePath, 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const configContent = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configContent);
        if (config.defaultUrl) {
          defaultUrl = config.defaultUrl;
        }
      } catch (err) {
        console.error(`Error reading profile config: ${err.message}`);
      }
    }
    
    // Nếu không có URL mặc định của profile, lấy URL mặc định toàn cục
    if (defaultUrl === 'https://www.google.com.vn') {
      const settingsPath = path.join(__dirname, 'settings.json');
      if (fs.existsSync(settingsPath)) {
        try {
          const settingsContent = fs.readFileSync(settingsPath, 'utf8');
          const settings = JSON.parse(settingsContent);
          if (settings.defaultUrl) {
            defaultUrl = settings.defaultUrl;
          }
        } catch (err) {
          console.error(`Error reading global settings: ${err.message}`);
        }
      }
    }
    
    console.log(`Using default URL for admin profile ${profileName}: ${defaultUrl}`);
    
    // Tạo session với admin mode
    const sessionId = uuidv4();
    let containerPort = 9222;
    let portFound = false;
    let maxAttempts = 10;

    console.log(`Creating admin session with profile ${profileName}`);
    
    // Logic tạo container tương tự như API sessions thông thường
    // nhưng với admin mode bật
    while (!portFound && maxAttempts > 0) {
      try {
        console.log(`Trying to start admin container with profile ${profileName} on port ${containerPort}`);
        
        const container = await docker.createContainer({
          Image: 'chrome-base',  // Sử dụng chrome-base thay vì chrome-kiosk
          name: `chrome-session-${sessionId}`,
          Hostname: `chrome-session-${sessionId}`,
          ExposedPorts: {
            '8080/tcp': {}
          },
          Env: [
            "DISPLAY=:99",
            "RESOLUTION=1440x900x24",
            "ADMIN_MODE=1",  // Luôn bật admin mode
            `DEFAULT_URL=${defaultUrl}`
          ],
          HostConfig: {
            NetworkMode: 'chrome-browser_chrome-network',
            PortBindings: {
              '8080/tcp': [{ HostPort: containerPort.toString() }]
            },
            Binds: [
              `${hostProfilesDir}/${profileName}:/app/chrome-profiles/default:rw`
            ],
            Privileged: false,
            ReadonlyRootfs: false
          }
        });

        await container.start();
        
        // Get container info
        const containerInfo = await container.inspect();
        
        activeSessions[sessionId] = {
          containerId: containerInfo.Id,
          port: containerPort,
          profile: profileName,
          adminMode: true,
          startTime: new Date()
        };
        
        portFound = true;
        console.log(`Started new ADMIN session: ${sessionId} on port ${containerPort} with profile ${profileName}`);
      } catch (err) {
        if (err.message && err.message.includes('port is already allocated')) {
          console.log(`Port ${containerPort} is already in use, trying next port`);
          containerPort++;
          maxAttempts--;
        } else {
          throw err;
        }
      }
    }

    if (!portFound) {
      return res.status(500).json({ error: 'Failed to find available port after multiple attempts' });
    }

    res.json({
      sessionId,
      port: containerPort,
      profile: profileName,
      adminMode: true,
      url: `http://${req.hostname}:${containerPort}/vnc.html?autoconnect=true&resize=scale&password=`
    });
  } catch (err) {
    console.error('Error creating admin session:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// API to save profile URL
app.post('/save-profile-url/:profileName', (req, res) => {
  const { profileName } = req.params;
  const { defaultUrl } = req.body;
  
  if (!defaultUrl) {
    return res.status(400).json({ error: 'URL is required' });
  }
  
  // Validate URL
  try {
    new URL(defaultUrl);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }
  
  try {
    const profilePath = path.join(profilesDir, profileName);
    
    // Kiểm tra xem profile có tồn tại không
    if (!fs.existsSync(profilePath)) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    // Lưu URL vào file config
    const configPath = path.join(profilePath, 'config.json');
    let config = {};
    
    // Kiểm tra xem file config đã tồn tại hay chưa
    if (fs.existsSync(configPath)) {
      try {
        const configContent = fs.readFileSync(configPath, 'utf8');
        config = JSON.parse(configContent);
      } catch (err) {
        console.error(`Error reading profile config: ${err.message}`);
        config = {};
      }
    }
    
    // Cập nhật URL mặc định
    config.defaultUrl = defaultUrl;
    
    // Ghi file config
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`Updated profile config with default URL: ${defaultUrl}`);
    
    res.json({ success: true, message: `Default URL saved for profile ${profileName}` });
  } catch (error) {
    console.error(`Error saving profile URL: ${error.message}`);
    res.status(500).json({ error: 'Failed to save profile URL' });
  }
});

// API to save global settings
app.post('/api/settings', (req, res) => {
  const { defaultUrl } = req.body;
  
  if (!defaultUrl) {
    return res.status(400).json({ error: 'URL is required' });
  }
  
  // Validate URL
  try {
    new URL(defaultUrl);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }
  
  try {
    // Lưu cài đặt global vào file
    const settingsPath = path.join(__dirname, 'settings.json');
    let settings = { defaultUrl };
    
    // Ghi file settings
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    console.log(`Updated global settings with default URL: ${defaultUrl}`);
    
    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (error) {
    console.error(`Error saving settings: ${error.message}`);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// API to get global settings
app.get('/api/settings', (req, res) => {
  try {
    const settingsPath = path.join(__dirname, 'settings.json');
    let settings = { defaultUrl: 'https://www.google.com.vn' };
    
    if (fs.existsSync(settingsPath)) {
      try {
        const settingsContent = fs.readFileSync(settingsPath, 'utf8');
        settings = JSON.parse(settingsContent);
      } catch (err) {
        console.error(`Error reading settings: ${err.message}`);
      }
    } else {
      // Tạo file settings mặc định nếu chưa tồn tại
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    }
    
    res.json({ settings });
  } catch (error) {
    console.error(`Error getting settings: ${error.message}`);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// Start the server
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log('Server đang chạy trong chế độ phát triển với hot-reload');
}); 