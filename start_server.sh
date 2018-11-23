
if [[ $1 == 't' ]] ; then
    # Start the node process
    sudo node server.js
elif [[ $1 == 'f' ]] ; then
    # Start forever process
    sudo forever start server.js
else 
    echo Invalid user input
fi