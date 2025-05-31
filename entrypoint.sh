#!/bin/bash
# Create an empty .Xauthority file if it doesn't exist (important for X11 authentication)
touch ${HOME}/.Xauthority

# Start Xvfb in the background on display :99
echo "Starting Xvfb on display :99..."
Xvfb :99 -screen 0 1920x1080x24 &
sleep 3

# Start the MCP server (server.py) in the background
echo "Starting server.py..."
python server.py &
server_pid=$!

# Start the autojoin process (script.py) in the background
echo "Starting script.py..."
python script.py &
autojoin_pid=$!

# Optionally, print PIDs for debugging
echo "server.py PID: ${server_pid}"
echo "script.py PID: ${autojoin_pid}"

# Wait for all background processes (if any of them terminates, the container will exit)
wait