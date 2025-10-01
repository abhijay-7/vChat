import React, { useRef, useState, useEffect, useCallback } from "react";
import useWsStore from "./store/wsStore";

const VidComp = ({ roomId }) => {
    const socket = useWsStore((s) => s.socket);
    const pcs = useWsStore((s) => s.pcs);

    const vidRef = useRef(null);
    const [incomingFrom, setIncomingFrom] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState({});
    const [isInCall, setIsInCall] = useState(false);

    const createPeerConnection = useCallback(
        (peerId) => {
            if (pcs.has(peerId)) return pcs.get(peerId);

            const pc = new RTCPeerConnection({
                iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
            });

            pcs.set(peerId, pc);

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit("candidate", {
                        candidate: event.candidate,
                        to: peerId,
                    });
                }
            };

            pc.ontrack = (event) => {
                console.log("Received track from", peerId);
                setRemoteStreams((prev) => ({
                    ...prev,
                    [peerId]: event.streams[0],
                }));
            };

            pc.onconnectionstatechange = () => {
                console.log(
                    `Connection state with ${peerId}:`,
                    pc.connectionState
                );
            };

            return pc;
        },
        [pcs, socket]
    );

    // Handle existing peers
    const handleExistingPeers = useCallback(
        async (peers = []) => {
            console.log("Existing peers:", peers);
            const localStream = useWsStore.getState().stream;

            for (const peerId of peers) {
                if (!peerId || peerId === socket.id) continue;
                if (pcs.has(peerId)) continue;

                console.log("Creating offer for peer:", peerId);
                const pc = createPeerConnection(peerId);

                if (localStream) {
                    localStream
                        .getTracks()
                        .forEach((t) => pc.addTrack(t, localStream));
                }

                try {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    socket.emit("send-offer", { offer, to: peerId });
                    console.log("Sent offer to", peerId);
                } catch (err) {
                    console.error("Error creating offer for", peerId, err);
                }
            }
        },
        [socket, pcs, createPeerConnection]
    );

    // Accept offer
    const acceptOffer = useCallback(
        async ({ from, offer }) => {
            if (!from || !offer) return;
            console.log("Accepting offer from", from);

            const pc = createPeerConnection(from);

            let localStream = useWsStore.getState().stream;
            if (!localStream) {
                try {
                    localStream = await navigator.mediaDevices.getUserMedia({
                        video: true,
                        audio: true,
                    });
                    useWsStore.setState({ stream: localStream });
                    if (vidRef.current) vidRef.current.srcObject = localStream;
                } catch (err) {
                    console.error("getUserMedia failed:", err);
                }
            }

            if (localStream) {
                localStream
                    .getTracks()
                    .forEach((t) => pc.addTrack(t, localStream));
            }

            try {
                await pc.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit("send-answer", { answer, to: from });
                console.log("Sent answer to", from);
            } catch (err) {
                console.error("Error accepting offer from", from, err);
            }
        },
        [socket, createPeerConnection]
    );

    // Accept answer
    const acceptAnswer = useCallback(
        async ({ from, answer }) => {
            if (!from || !answer) return;
            console.log("Accepting answer from", from);

            const pc = pcs.get(from);
            if (!pc) return console.warn("No RTCPeerConnection for", from);

            try {
                await pc.setRemoteDescription(
                    new RTCSessionDescription(answer)
                );
            } catch (err) {
                console.error(
                    "Error setting remote description (answer) from",
                    from,
                    err
                );
            }
        },
        [pcs]
    );

    // Update ICE candidate
    const updateIceCandidate = useCallback(
        async ({ from, candidate }) => {
            if (!from || !candidate) return;

            const pc = pcs.get(from);
            if (!pc) return;

            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
                console.log("Added ICE candidate from", from);
            } catch (err) {
                console.error("Error adding ICE candidate from", from, err);
            }
        },
        [pcs]
    );

    const handleIncomingCall = useCallback((payload) => {
        console.log("Incoming call from", payload?.from);
        setIncomingFrom(payload?.from || null);
    }, []);

    const initiateCall = async () => {
        if (!roomId) {
            alert("Please join a room first!");
            return;
        }
        try {
            const localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            console.log(localStream);
            useWsStore.setState({ stream: localStream });
            if (vidRef.current) vidRef.current.srcObject = localStream;

            // Join room first
            socket.emit("join-room", roomId);

            // Then initiate call
            socket.emit("initiate-call", { roomId });
            setIsInCall(true);
            console.log("Initiated call in room", roomId);
        } catch (err) {
            console.error("getUserMedia failed:", err);
        }
    };

    // Answer call
    const answerCall = async () => {
        if (!roomId) {
            alert("Please join a room first!");
            return;
        }

        let localStream = useWsStore.getState().stream;
        if (!localStream) {
            try {
                localStream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true,
                });
                useWsStore.setState({ stream: localStream });
                if (vidRef.current) vidRef.current.srcObject = localStream;
            } catch (err) {
                console.error("getUserMedia failed:", err);
                return;
            }
        }

        socket.emit("join-room", roomId);

        // Then answer call
        socket.emit("answer-call", { roomId });
        setIsInCall(true);
        setIncomingFrom(null);
        console.log("Answered call in room", roomId);
    };

    const handleEndCallbyPeer = ({ from }) => {
        const pc = pcs.get(from);
        if (pc) {
            pc.close();
            pcs.delete(from);
        }

        setRemoteStreams((prev) => {
            const updated = { ...prev };
            delete updated[from];
            return updated;
        });
    };

    useEffect(() => {
        if (!socket) return;

        console.log("Setting up socket listeners");

        socket.on("existing-peers", handleExistingPeers);
        socket.on("incoming-call", handleIncomingCall);
        socket.on("call-ended-by-peer", handleEndCallbyPeer);
        socket.on("offer", acceptOffer);
        socket.on("answer", acceptAnswer);
        socket.on("ice-candidate-update", updateIceCandidate);

        return () => {
            console.log("Cleaning up socket listeners");
            socket.off("existing-peers", handleExistingPeers);
            socket.off("incoming-call", handleIncomingCall);
            socket.off("offer", acceptOffer);
            socket.off("answer", acceptAnswer);
            socket.off("ice-candidate-update", updateIceCandidate);

            // Close all peer connections
            for (const [peerId, pc] of pcs.entries()) {
                try {
                    pc.close();
                } catch (e) {
                    console.error("Error closing peer connection:", e);
                }
            }
            pcs.clear();

            // Stop local stream
            const localStream = useWsStore.getState().stream;
            if (localStream) {
                localStream.getTracks().forEach((track) => track.stop());
                useWsStore.setState({ stream: null });
            }
        };
    }, [
        socket,
        handleExistingPeers,
        handleIncomingCall,
        acceptOffer,
        acceptAnswer,
        updateIceCandidate,
        pcs,
    ]);

    const endCall = async () => {
        if (!isInCall) return
        const localStream = useWsStore.getState().stream;
        if (localStream) {
            localStream.getTracks().forEach((track) => track.stop());
        }
        pcs.forEach((pc, peerId) => pc.close());
        pcs.clear();
        socket.emit("end-call", { roomId });
        setIsInCall(false);
        useWsStore.setState({ stream: null });
        setIncomingFrom(null);
        if (vidRef.current) {
            vidRef.current.srcObject = null;
        }
    };

    // Remote video component
    function RemoteVideo({ peerId, stream }) {
        return (
            <video
                key={peerId}
                autoPlay
                playsInline
                muted={false}
                ref={(el) => {
                    if (el) el.srcObject = stream;
                }}
                style={{
                    width: 200,
                    height: 150,
                    margin: 6,
                    backgroundColor: "black",
                    border: "2px solid #4CAF50",
                }}
            />
        );
    }

    return (
        <div
            style={{
                padding: "20px",
                backgroundColor: "chocolate",
                borderRadius: "8px",
            }}
        >
            <h3>Video Call - Room: {roomId || "No room joined"}</h3>

            <div style={{ marginBottom: 12 }}>
                <button
                    onClick={initiateCall}
                    disabled={!roomId || isInCall}
                    style={{
                        padding: "8px 16px",
                        marginRight: 8,
                        backgroundColor: isInCall ? "#ccc" : "#4CAF50",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: isInCall ? "not-allowed" : "pointer",
                    }}
                >
                    Call (initiate)
                </button>
                <button
                    onClick={answerCall}
                    disabled={!roomId || isInCall}
                    style={{
                        padding: "8px 16px",
                        backgroundColor: isInCall ? "#ccc" : "#2196F3",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: isInCall ? "not-allowed" : "pointer",
                    }}
                >
                    Join / Answer call
                </button>
                <button
                    onClick={endCall}
                    disabled={!roomId || !isInCall}
                    style={{
                        padding: "8px 16px",
                        backgroundColor: !isInCall ? "#ccc" : "#2196F3",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: !isInCall ? "not-allowed" : "pointer",
                    }}
                >
                    End call
                </button>
                {incomingFrom && (
                    <span
                        style={{
                            marginLeft: 12,
                            color: "#ff9800",
                            fontWeight: "bold",
                        }}
                    >
                        📞 Incoming call from {incomingFrom}
                    </span>
                )}
            </div>

            <div style={{ marginBottom: 12 }}>
                <h4>Your Video:</h4>
                <video
                    ref={vidRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                        width: 320,
                        height: 240,
                        backgroundColor: "black",
                        border: "2px solid #2196F3",
                        borderRadius: "4px",
                    }}
                />
            </div>

            <div>
                <h4>Remote Videos ({Object.keys(remoteStreams).length}):</h4>
                <div
                    style={{ display: "flex", flexWrap: "wrap", marginTop: 12 }}
                >
                    {Object.entries(remoteStreams).map(([peerId, s]) => (
                        <div
                            key={peerId}
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                margin: "4px",
                            }}
                        >
                            <RemoteVideo peerId={peerId} stream={s} />
                            <div style={{ fontSize: 12, marginTop: 4 }}>
                                Peer: {peerId.substring(0, 8)}...
                            </div>
                        </div>
                    ))}
                    {Object.keys(remoteStreams).length === 0 && isInCall && (
                        <div style={{ padding: "20px", color: "#666" }}>
                            No remote peers connected yet...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VidComp;
