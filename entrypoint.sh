#!/bin/bash
# Create an empty .Xauthority file if it doesn't exist (important for X11 authentication)
touch ${HOME}/.Xauthority

# Remove any existing Xvfb lock file for display :99 if it exists
if [ -f /tmp/.X99-lock ]; then
    echo "Removing existing Xvfb lock file..."
    rm -f /tmp/.X99-lock
fi

# Start Xvfb in the background on display :99
echo "Starting Xvfb on display :99..."
Xvfb :99 -screen 0 1920x1080x24 &
sleep 3

# Start the server and script processes
echo "Starting server.py..."
python server.py &
server_pid=$!

echo "Starting script.py..."
python script.py &
autojoin_pid=$!

# Optionally print process IDs for debugging
echo "server.py PID: ${server_pid}"
echo "script.py PID: ${autojoin_pid}"

# Wait for all background processes to finish
wait