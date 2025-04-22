#!/bin/bash

echo "Stopping existing containers..."
docker-compose down

echo "Building and starting with simple Dockerfile..."
docker-compose -f docker-compose.simple.yml up -d --build

echo "Checking containers..."
docker ps

echo "Waiting 5 seconds for containers to start..."
sleep 5

echo "Chrome container logs:"
docker logs $(docker ps -q --filter name=chrome-kiosk-simple) 2>&1 | tail -n 50

echo "Done. Access web interface at http://localhost:3000" 