import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import useWsStore from './store/wsStore'
import { useEffect } from 'react'
import MsgCount from './temp'
import VidComp from './call'

function App() {
  const [count, setCount] = useState(0)
  const [message, setMessage] = useState("")
  const [room, setRoom] = useState("")
  const [currRoom, setCurrRoom] = useState("")
  const socket = useWsStore(state => state.socket);
  const [chatHistory , setCh] = useState([]);
  const [roomChatHistory , setRCh] = useState([]);
  const [isConnected, setIsConnected] =  useState(false)


  useEffect(()=>{
    function onConnect(e){
      console.log(e);
      console.log("ws connected")
      setIsConnected(true);
    }
    function onDisconnect(){
      console.log("ws disconnected")
      setIsConnected(false)
      // setCh([]);
      // setRCh([])
    }

    function onMessage(val){
      console.log(val);
      setCh([...chatHistory , val])
    }
    function onRoomMessage(val){
      console.log(val);
      setRCh([...roomChatHistory , val])
    }

    
    
    socket.on("connect", onConnect);
    socket.on("message", onMessage);
    socket.on("disconnect", onDisconnect);
    socket.on("message-room", onRoomMessage);
    
    return () =>{
      socket.off("connect", onConnect);
      socket.off("message", onMessage);
      socket.off("disconnect", onDisconnect);
    }

  })

  function sendMessage(){
    socket.emit("message",message);
    setMessage("")
  }
  
  function broadcastMessage(){
    socket.emit("broadcast-request",message);
    setMessage("")
  }
  function broadcastMessage(){
    socket.emit("broadcast-request",message);
    setMessage("")
  }
  function sendRoomMessage(){
    socket.emit("send-message-room",{roomId : currRoom,message});
    setMessage("")
  }
  function joinRoom(){
    socket.emit("join-room", room);
    setCurrRoom(room);
  }


  return (
   <>
   <MsgCount/>
    <button onClick={ ()=>{
      if(!isConnected){
        socket.connect()
      }
      else{
        socket.disconnect()
      }
    }}> {!isConnected ? "connect" : "disconnect"}</button>
    <br/>
    <input type='text' value={message} onChange={(e)=> setMessage(e.target.value)} />
    <button onClick={sendMessage}>send</button>

    <button onClick={broadcastMessage}>broadcast</button>
    <button onClick={sendRoomMessage}>To room</button>
    <br/>
    <input type='text' value={room} onChange={(e)=> setRoom(e.target.value)} placeholder='enter room id to join' />
    <button onClick={joinRoom}>joinRoom</button>
   
    
    <div>
      <h2> Chat messages </h2>
      
      <div style={{backgroundColor:"coral", borderWidth: "5px", borderRadius: "10px", padding : "5px", margin:"20px" }}> 
        {
          chatHistory?.map((item,index)=>(
            <>
            <div key={index} style = {{backgroundColor: "peachpuff", color:"black" , borderWidth: "5px", borderRadius: "10px", padding : "5px", margin:"20px"}} >
              
               {item} </div>
            </>
          ))
        }  
      </div>
      <h2> Room messages </h2>
       <div style={{backgroundColor:"cyan", borderWidth: "5px", borderRadius: "10px", padding : "5px", margin:"40px" }}> 
        {
          roomChatHistory?.map((item,index)=>(
            <>
            <div key={index} style = {{backgroundColor: "coral", color:"black" , borderWidth: "5px", borderRadius: "10px", padding : "5px", margin:"20px"}} >
              
              {item.sender} : {item.message} </div>
            </>
          ))
        }  
      </div>
      <VidComp roomId={currRoom} ></VidComp>
    </div>
   </>
  )
}

export default App
