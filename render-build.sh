#!/bin/bash
echo "🔧 FORCE INSTALLING DEPENDENCIES..."
npm install --production
echo "✅ DEPENDENCIES INSTALLED"
node server.js
