#!/bin/bash

echo "🚀 Building Firebase Functions..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo "🚀 Deploying to Firebase..."
    firebase deploy --only functions
else
    echo "❌ Build failed!"
    exit 1
fi 