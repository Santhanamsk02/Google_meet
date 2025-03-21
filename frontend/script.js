const socket = io("http://localhost:5000");
const videoGrid = document.getElementById("videoGrid");
const userNames = {};

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get("roomId");
const userName = urlParams.get("userName");

const peer = new Peer();
const peers = {};
let myVideo = document.createElement("video");
myVideo.muted = true;


let registeredDescriptor = null;
let recognitionInterval = null;
let recognizedTime = 0;
let attendanceMarked = false;
let failureTime = 0;
const maxFailureTime = 20;

// Load video stream
navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
    myVideo.srcObject = stream;
    myVideo.addEventListener("loadedmetadata", () => {
        myVideo.play();
    });
    videoGrid.appendChild(myVideo);

    peer.on("open", userId => {
        console.log("Connected to Peer Server, ID:", userId);
        socket.emit("join-room", roomId, userId, userName);
    });

    socket.on("user-connected", ({ userId, userName }) => {
        userNames[userId] = userName;
        console.log(`${userName} (${userId}) joined the room.`);
        connectToNewUser(userName,userId, stream);
    });

    function getUserNameById(userId) {
        return userNames[userId] || "Unknown User";
    }
    peer.on("call", call => {
        call.answer(stream);
        const video = document.createElement("video");
        const userId = call.peer;
        const Name = getUserNameById(userId);
        call.on("stream", userStream => {
            addVideoStream(Name,video, userStream);
        });
    });

    socket.on("user-disconnected", userId => {
        console.log(`User ${userId} disconnected.`);
        if (peers[userId]) peers[userId].close();
    });

    loadModels().then(() => registerAndRecognizeFace(stream));
});

function connectToNewUser(userName,userId, stream) {
    const call = peer.call(userId, stream);
    console.log(userName+' Connected');
    const video = document.createElement("video");
    call.on("stream", userStream => {
        addVideoStream(userName,video, userStream);
    });
    peers[userId] = call;
}

function addVideoStream(Name,video, stream) {
    video.srcObject = stream;
    video.addEventListener("loadedmetadata", () => {
        video.play();
    });
    videoGrid.appendChild(video);
    console.log("Added :"+Name+"Video Stream");
}

async function loadModels() {
    console.log("Loading face-api models...");
    await faceapi.nets.tinyFaceDetector.loadFromUri('./models');
    await faceapi.nets.faceLandmark68Net.loadFromUri('./models');
    await faceapi.nets.faceRecognitionNet.loadFromUri('./models');
    console.log("Models loaded successfully.");
}

async function registerAndRecognizeFace(stream) {
    console.log("Registering face...");
    const detection = await faceapi.detectSingleFace(myVideo, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

    if (detection) {
        registeredDescriptor = detection.descriptor;
        alert("Face registered successfully! Recognition started.");
        recognizeFace();
    } else {
        alert("No face detected. Please try again.");
    }
}

async function recognizeFace() {
    if (!registeredDescriptor) {
        alert("No face registered.");
        return;
    }

    if (recognitionInterval) clearInterval(recognitionInterval);

    recognitionInterval = setInterval(async () => {
        const detections = await faceapi.detectAllFaces(myVideo, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors();
        
   

        let faceRecognized = false;
        let minDistance = Infinity;

        detections.forEach(detection => {
            const { box } = detection.detection;
            const distance = faceapi.euclideanDistance(registeredDescriptor, detection.descriptor);
            minDistance = Math.min(minDistance, distance);

            faceRecognized = minDistance < 0.5;

        });

        if (faceRecognized) {
            recognizedTime += 1;
            failureTime = 0;
            console.log(`Recognized for ${recognizedTime} seconds`);
        } else {
            failureTime += 1;
            console.log(`Recognition failed for ${failureTime} seconds`);

            if (failureTime > maxFailureTime) {
                recognizedTime = 0;
                attendanceMarked = false;
                console.log("Recognition reset due to extended failure");
            }
        }

        if (recognizedTime >= 40 && !attendanceMarked) {
            alert("Your attendance is marked!");
            attendanceMarked = true;
        }

    }, 1000);
}

