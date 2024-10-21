import React, { useRef, useEffect, useState } from "react";
import io from "socket.io-client";
import Header from "./Header";
import { IoSend } from "react-icons/io5";
import { ImSpinner3 } from "react-icons/im"; // Ensure you have react-bootstrap installed

const socket = io("https://blinkchat-p53w.onrender.com");

const ChatHome = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [chatRoom, setChatRoom] = useState(null);
  const [isConnectedToChat, setIsConnectedToChat] = useState(false);
  const [peerConnection, setPeerConnection] = useState(null);
  const [isSearching, setIsSearching] = useState(true); // Track loading state for remote video
  const [quote, setQuote] = useState("Searching for a stranger..."); // Placeholder quote

  const messagesEndRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const iceServers = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

  useEffect(() => {
    socket.on("connectedToChat", (room) => {
      setChatRoom(room);
      setIsConnectedToChat(true);
      console.log(`Connected to room: ${room}`);

      setMessages((prevMessages) => [
        ...prevMessages,
        { id: "system", text: "Stranger connected.", type: "connected" },
      ]);

      setIsSearching(true); // Start searching/loading
    });

    socket.on("message", (message) => {
      setMessages((prevMessages) => [...prevMessages, message]);
    });

    return () => {
      socket.off("connectedToChat");
      socket.off("message");
    };
  }, []);

  useEffect(() => {
    const pc = new RTCPeerConnection(iceServers);
    setPeerConnection(pc); // Save peer connection state

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", event.candidate);
      }
    };

    pc.ontrack = (event) => {
      console.log("remote videoref", event.streams[0]);
      remoteVideoRef.current.srcObject = event.streams[0];
      setIsSearching(false); // Stop showing loading
    };

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        localVideoRef.current.srcObject = stream;
        console.log("local video", stream);

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      })
      .catch((error) => {
        console.error("Error accessing media devices:", error);
      });

    socket.on("offer", async (offer) => {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer", answer);
      } catch (error) {
        console.error("Error handling offer", error);
      }
    });

    socket.on("answer", async (answer) => {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (error) {
        console.error("Error handling answer", error);
      }
    });

    socket.on("ice-candidate", async (candidate) => {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("Error adding received ICE candidate", error);
      }
    });

    pc.onnegotiationneeded = async () => {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("offer", offer);
      } catch (error) {
        console.error("Error during negotiation", error);
      }
    };

    return () => {
      pc.close();
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
    };
  }, [chatRoom]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = () => {
    if (newMessage.trim() && chatRoom) {
      socket.emit("message", { room: chatRoom, text: newMessage });
      setNewMessage("");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  };

  const handleNewStranger = () => {
    if (peerConnection) peerConnection.close();
    setPeerConnection(null);

    // Disconnect and clear state
    socket.disconnect();
    setMessages([]);
    setChatRoom(null);
    setIsConnectedToChat(false);
    setIsSearching(true);

    // Clear remote video
    if (remoteVideoRef.current.srcObject) {
      remoteVideoRef.current.srcObject.getTracks().forEach((track) => {
        track.stop();
      });
      remoteVideoRef.current.srcObject = null;
    }

    socket.connect();
  };

  // Handle stranger disconnection by stopping remote video
  useEffect(() => {
    socket.on("message", (message) => {
      if (message.text === "Stranger has been disconnected.") {
        setIsConnectedToChat(false);

        if (remoteVideoRef.current.srcObject) {
          remoteVideoRef.current.srcObject.getTracks().forEach((track) => {
            track.stop();
          });
          remoteVideoRef.current.srcObject = null;
        }
      }
    });

    return () => {
      socket.off("message");
    };
  }, []);

  return (
    <>
      <Header />
      <main className="d-flex flex-wrap" style={{ height: "90vh" }}>
        <div
          className="d-flex flex-column justify-content-between"
          style={{ width: "25%", height: "100%" }}
        >
          <div className="d-flex flex-column justify-content-between">
            <div
              className="card rounded-0 border-0 mb-1 bg-secondary"
              style={{ height: "21rem" }}
            >
              <div className="card-body p-0">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  className="w-100 h-100"
                  style={{ objectFit: "cover" }}
                />
              </div>
            </div>
            <div
              className="card rounded-0 border-0 bg-secondary"
              style={{ height: "21.8rem" }}
            >
              <div className="card-body p-0 position-relative">
                {/* {isSearching ? (
                  <div className="d-flex flex-column align-items-center justify-content-center h-100">
                    <ImSpinner3 />
                    <p>{quote}</p>
                  </div>
                ) : ( */}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  muted
                  className="w-100 h-100"
                  style={{ objectFit: "cover" }}
                />
                {/* )} */}
              </div>
            </div>
          </div>
        </div>

        <div className="container d-flex flex-column" style={{ width: "50%" }}>
          <div className="row flex-grow-1 justify-content-center">
            <div className="col">
              <div className="card shadow-none rounded-0 border-0">
                <div
                  className="card-body overflow-auto"
                  style={{ height: "80vh" }}
                >
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`d-flex flex-column ${
                        message.id === socket.id
                          ? "align-items-end"
                          : message.id === "system"
                          ? "align-items-center"
                          : "align-items-start"
                      }`}
                    >
                      {message.id === "system" ? (
                        <span
                          className={`small fs-5 p-3 fw-bold mb-2 ${
                            message.type === "connected"
                              ? "bg-success"
                              : "bg-danger"
                          }`}
                        >
                          {message.text}
                        </span>
                      ) : (
                        <>
                          <span
                            className={`small mb-1 fw-bold ${
                              message.id === socket.id
                                ? "text-success"
                                : "text-danger"
                            }`}
                          >
                            {message.id === socket.id ? "You:" : "Stranger:"}
                          </span>
                          <div
                            className={`d-flex flex-row ${
                              message.id === socket.id
                                ? "justify-content-end"
                                : "justify-content-start"
                            }`}
                          >
                            <div>
                              <p
                                className={`ps-4 pe-4 p-3 ms-3 mb-1 rounded-3 fs-3 ${
                                  message.id === socket.id
                                    ? "bg-primary text-white user-bubble"
                                    : "bg-light stranger-bubble"
                                }`}
                              >
                                {message.text}
                              </p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                <div className="card-footer d-flex align-items-center gap-3">
                  <div>
                    <button
                      className="btn btn-outline-primary fs-5 fw-bold lh-1"
                      onClick={handleNewStranger}
                      disabled={!isConnectedToChat}
                    >
                      New Stranger
                    </button>
                  </div>
                  <input
                    type="text"
                    className="form-control form-control-lg"
                    placeholder="Enter message"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={!isConnectedToChat}
                  />
                  <div>
                    <IoSend
                      size={35}
                      color="blue"
                      style={{ cursor: "pointer" }}
                      onClick={handleSendMessage}
                      disabled={!isConnectedToChat}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className="d-flex flex-column"
          style={{ width: "25%", height: "100%" }}
        >
          <div className="flex-grow-1 bg-light d-flex align-items-center justify-content-center">
            Ad 1
          </div>
          <div className="flex-grow-1 bg-light d-flex align-items-center justify-content-center">
            Ad 2
          </div>
        </div>
      </main>
    </>
  );
};

export default ChatHome;
