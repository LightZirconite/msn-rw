#!/bin/bash
echo "Launching Microsoft Rewards Script..."

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "ERROR: npm is not installed or not in PATH."
    echo "Please install Node.js from https://nodejs.org/"
    read -p "Press Enter to continue..."
    exit 1
fi

# Check if dist folder exists, otherwise build the project
if [ ! -d "dist" ]; then
    echo "The dist folder doesn't exist, building the project..."
    npm run build
    if [ $? -ne 0 ]; then
        echo "ERROR: Build failed."
        read -p "Press Enter to continue..."
        exit 1
    fi
fi

# Launch the script
npm run start
if [ $? -ne 0 ]; then
    echo "ERROR: The script encountered an error."
    read -p "Press Enter to continue..."
    exit 1
fi

echo "Script completed successfully."
read -p "Press Enter to continue..."