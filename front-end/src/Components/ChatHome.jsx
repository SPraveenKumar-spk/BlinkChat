import React, { useRef, useEffect, useState } from "react";
import io from "socket.io-client";
import Header from "./Header";
import { IoSend } from "react-icons/io5";
const socket = io("https://blinkchat-p53w.onrender.com");

const ChatHome = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [chatRoom, setChatRoom] = useState(null);
  const [isConnectedToChat, setIsConnectedToChat] = useState(false);
  const [peerConnection, setPeerConnection] = useState(null);
  const [isSearching, setIsSearching] = useState(true);
  const quote = "Searching";
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
      // Stop showing loading
      setIsSearching(false);
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
      setIsSearching(true);
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

    // Clear remote video
    if (remoteVideoRef.current.srcObject) {
      remoteVideoRef.current.srcObject.getTracks().forEach((track) => {
        track.stop();
      });

      remoteVideoRef.current.srcObject = null;
      setIsSearching(true);
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

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === "Escape") {
        handleNewStranger();
      }
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [peerConnection]);

  console.log(isSearching);

  return (
    <>
      <Header />
      <main className="d-flex flex-wrap" style={{ height: "90vh" }}>
        <div className="col-lg-3 col-md-4 p-2 mobile-relative">
          <div className="card border-0 mb-0 mb-md-3 overflow-hidden">
            <div className="card-body p-0">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                className="w-100 h-100 object-fit-cover"
              />
            </div>
          </div>
          <div className="card overflow-hidden mobile-absolute h-50 border-0">
            <div className="card-body p-0">
              {isSearching && (
                <div
                  className="d-flex flex-column align-items-center justify-content-center h-100 position-absolute"
                  style={{
                    background: "rgba(255, 255, 255, 0.8)",
                    width: "100%",
                    height: "100%",
                    zIndex: 10,
                  }}
                >
                  {/* <ImSpinner3 className="spinner" /> */}
                  <p>{quote}</p>
                </div>
              )}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-100 h-100 object-fit-cover"
              />
            </div>
          </div>
        </div>

        <div className="col-lg-6 col-md-8 p-2 chat-container">
          <div className="card h-100">
            <div className="card-body overflow-auto" style={{ height: "80vh" }}>
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
                      className={`small fw-bold mb-2 ${
                        message.type === "connected"
                          ? "bg-success text-white"
                          : "bg-danger text-white"
                      } pt-2 pb-2 ps-1 pe-1 rounded`}
                    >
                      {message.text}
                    </span>
                  ) : (
                    <>
                      <span
                        className={`small fw-bold ${
                          message.id === socket.id
                            ? "text-success"
                            : "text-danger"
                        }`}
                      >
                        {message.id === socket.id ? "You:" : "Stranger:"}
                      </span>
                      <p
                        className={`pt-1 pb-1 ps-2 pe-2 mb-2 position-relative ${
                          message.id === socket.id
                            ? "bg-primary text-white right"
                            : "bg-secondary text-black left"
                        }`}
                      >
                        {message.text}
                      </p>
                    </>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="card-footer d-flex align-items-center gap-3">
              <button
                className="btn btn-outline-primary"
                onClick={handleNewStranger}
              >
                New
              </button>

              <input
                autoFocus={true}
                type="text"
                className="form-control"
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <button className="btn btn-primary" onClick={handleSendMessage}>
                <IoSend />
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
};

export default ChatHome;
