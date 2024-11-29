const EventEmitter = require('events')
const schedule     = require('node-schedule')
const express      = require('express')
const http         = require("http")
const fs           = require('fs')

const app          = express()

const SAMPLE_SIZE = 32000                         // samples/sec
const PACKET_SIZE = SAMPLE_SIZE                   // 1 second worth of data
const UPDATE_TIME = '* * * * * *'                 // every second
const PATH        = "./src.mp3"
let   PACKET_NUM  = 0
const eventEmitter= new EventEmitter ()

async function getpacket(req,res){
  const file_descriptor     = fs.openSync(PATH, 'r', null)
  const read_offset         = PACKET_NUM * PACKET_SIZE
  const buffer              = Buffer.alloc(PACKET_SIZE)
  const buffer_write_offset = 0
  const num_bytes_to_read   = PACKET_SIZE
  const num_bytes_read      = fs.readSync(file_descriptor, buffer, buffer_write_offset, num_bytes_to_read, read_offset)
  fs.closeSync(file_descriptor)
  console.log(`Sending packet ${PACKET_NUM} to ${req.socket.remoteAddress}`) // safari sometimes requests two streams at the same time
  res.write(buffer)
}

app.get("/", (req,res)=>{
  res.sendFile("index_stack.html",{root: '.'})
})

app.get("/src.mp3", async (req,res)=>{
    res.writeHead(200,"OK",{"Content-Type":"audio/mpeg"})

    const updateHandler = () =>{ getpacket(req,res) }
    eventEmitter.on("update", updateHandler) // On update event, send another packet

    req.socket.on("close",()=>{
      eventEmitter.removeListener("update",updateHandler)
      console.log(`Client ${req.socket.remoteAddress} disconected from server`)
    })
})

// This creates a schedule to make an update event on every second
schedule.scheduleJob(UPDATE_TIME, function(){
  PACKET_NUM+=1
  eventEmitter.emit("update")
})

const server = http.createServer(app)
server.listen(3000)