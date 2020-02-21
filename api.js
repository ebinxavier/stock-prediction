const express = require('express');
const fetch = require('node-fetch')
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
var CronJob = require('cron').CronJob;

const allStocks={};

io.on('connection', (socket) => { 
    console.log('Connected');
    
    socket.on('init',(data, cb)=>{
        cb('connected to server');
    })

    socket.on('message',(data)=>{
        socket.broadcast.emit('data',{data:data});
    })

    socket.on('subscribe', function(room, cb) { 
        console.log('joining room', room);
        socket.join(room); 
        cb(allStocks[room] || 'No Data')
    })

    socket.on('unsubscribe', function(room) {  
        console.log('leaving room', room);
        socket.leave(room); 
    })

    socket.on('send', function(data) {
        console.log('sending message');
        io.sockets.in(data.room).emit('message', data);
    });

    socket.on('disconnect', function(){
        console.log('user disconnected');
    });
});

server.listen(4999, ()=>{
    console.log("App is listening in port: "+4999);
})



app.get('/all/:company',(req,res)=>{
    const range = req.query.range || '1d';
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${req.params.company}?region=IN&lang=en-IN&includePrePost=false&interval=1m&range=${range}&corsDomain=in.finance.yahoo.com&.tsrc=finance`
    fetch(url)
    .then(res => res.json())
    .then(json => res.send(json));
})

app.get('/',(req,res)=>{
    res.sendFile(__dirname+'/client/index.html');
})

app.get('/rooms',(req,res)=>{
    res.send(Object.keys(io.sockets.adapter.rooms).filter(e=>e.includes('room-')));
})


new CronJob('0 */1 * * * *', function() {
    console.log("Running cron job...", new Date());
    const rooms = Object.keys(io.sockets.adapter.rooms).filter(e=>e.includes('room-'));
    rooms.forEach(room=>{
        const range =  '1d';
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${room.split('room-')[1]}?region=IN&lang=en-IN&includePrePost=false&interval=1m&range=${range}&corsDomain=in.finance.yahoo.com&.tsrc=finance`
        fetch(url)
        .then(res => res.json())
        .then(json => {
            console.log("Api called: "+room, new Date())
            if(!allStocks[room]) {
                allStocks[room] = {timestamp: json.chart.result[0].timestamp, values: json.chart.result[0].indicators.quote[0]};
                io.sockets.in(room).emit('message', allStocks[room]);
                console.log("Initial data received for the first time: "+room, new Date())
            } else {
                if((allStocks[room] && json.chart.result[0].timestamp.length !== allStocks[room].timestamp.length)){
                    // New Data received, so publish
                    const newData = {
                        timestamp:json.chart.result[0].timestamp.pop(), 
                        values:{
                            high:json.chart.result[0].indicators.quote[0].high.pop(),
                            open:json.chart.result[0].indicators.quote[0].open.pop(),
                            low:json.chart.result[0].indicators.quote[0].low.pop(),
                            volume:json.chart.result[0].indicators.quote[0].volume.pop(),
                            close:json.chart.result[0].indicators.quote[0].close.pop(),
                        }
                    }
                    console.log("Received new data: "+room, new Date());
                    io.sockets.in(room).emit('message', newData);
                } else {
                    console.log("No new data received: "+room, new Date())
                }
            }
        }); 
    })
}).start();