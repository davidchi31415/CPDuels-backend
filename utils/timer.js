const timeouts = [];

io.on('Start Timer', () => {
    let timeout = setTimeout(() => {
        io.emit('Duel Over');
    }, 5000);
    timeouts.push(timeout);
});
io.on('Stop Timer', () => {
    clearTimeout(timeouts[timeouts.length-1]);
    console.log("Timer stopped.");  
});