import React, { createContext, useState, useRef, useEffect } from 'react';
import { io } from 'socket.io-client';

import Peer from 'simple-peer';

const SocketContext = createContext();

const socket = io('http://localhost:5000');

const ContextProvider = ({ children }) => {
  const [stream, setStream] = useState(null);
  const [me, setMe] = useState('');
  const [call, setCall] = useState({});
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [name, setName] = useState('');
  //setting state is not going to be enough, we have to deal with refs
  //because we immediately want to populate the video iframe with the src of our stream
  //useRef = allows to directly create a reference to the DOM element in the functional component.

  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();

  useEffect(() => {
    //what do we want to do as soon as the page loads - permission
    //to use video and audio from the user camera and microphone by using built in navigator
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((currentstream) => {
        setStream(currentstream);
        //we are not just setting the currentstream to the state but also to the ref
        myVideo.current.srcObject = currentstream;
      });
    //It will get the id as soon as the connection opens
    socket.on('me', (id) => setMe(id));
    socket.on('callUser', ({ from, name: callerName, signal }) => {
      //information of the call = who is calling, from who the call is, signal strength
      //Are we receiving the call or are we answering the call
      setCall({ isReceivingCall: true, from, name: callerName, signal });
    });
  }, []);

  const answerCall = () => {
    setCallAccepted(true);

    const peer = new Peer({ initiator: false, trickle: false, stream });
    //It behaves as socket
    //once we receive the signal, we get the data of that signal
    peer.on('signal', (data) => {
      socket.emit('answerCall', { signal: data, to: call.from });
      console.log(data);
    });
    //stream for the other person
    peer.on('stream', (currentstream) => {
      //Other user video
      userVideo.current.srcObject = currentstream;
    });
    //call is coming from setCall
    peer.signal(call.signal);
    //It means our current connection is equal to the current peer inside the connection
    connectionRef.current = peer;
  };
  const callUser = (id) => {
    //initiator: true(because we are the ones calling)
    const peer = new Peer({ initiator: true, trickle: false, stream });

    peer.on('signal', (data) => {
      //we emit the call this time
      //We know the user we call by the id gotten from parameters
      socket.emit('callUser', {
        userToCall: id,
        signalData: data,
        from: me,
        name,
      });
    });

    peer.on('stream', (currentStream) => {
      userVideo.current.srcObject = currentStream;
    });

    //When somebody is calling us, he can decline or accept the call, we have call accepted in the backend
    socket.on('callAccepted', (signal) => {
      setCallAccepted(true);

      peer.signal(signal);
    });

    connectionRef.current = peer;
  };

  const leaveCall = () => {
    setCallEnded(true);

    //it will destroy the connection - that way we are going to stop receiving input
    //from the user camera and audio
    connectionRef.current.destroy();

    window.location.reload(); // It reloads th page and provide the user with new Id
    //Because it seems difficult to work to get the user to call another user after hanging up the call
    //with the first user so we need to reload the page and it works afterward
  };

  return (
    <SocketContext.Provider
      value={{
        //Everything passed will be globally accessible to all of your component
        call,
        callAccepted,
        myVideo,
        userVideo,
        stream,
        name,
        setName,
        callEnded,
        me,
        callUser,
        leaveCall,
        answerCall,
      }}>
      {children}
    </SocketContext.Provider>
  );
};

export { ContextProvider, SocketContext };
