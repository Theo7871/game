import * as THREE from 'three';
import { io } from 'socket.io-client';

// 0. Connect to the multiplayer server dynamically
const socketUrl = import.meta.env.VITE_WS_URL || 
  ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
    ? 'http://localhost:3000' 
    : window.location.origin);
const socket = io(socketUrl);

// 1. Setup Scene, Camera, and Renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Procedural Character Creator
function createCharacter(color) {
    const group = new THREE.Group();

    // Body (Torso)
    const bodyGeometry = new THREE.BoxGeometry(0.6, 0.8, 0.4);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: color });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.5; // Offset to stand on floor
    group.add(body);

    // Head
    const headGeometry = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffdbac }); // Skin color
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.1;
    group.add(head);

    // Eyes
    const eyeGeometry = new THREE.BoxGeometry(0.06, 0.06, 0.06);
    const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
    
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.1, 1.15, 0.21);
    group.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.1, 1.15, 0.21);
    group.add(rightEye);

    // Arms
    const armGeometry = new THREE.BoxGeometry(0.15, 0.6, 0.15);
    const armMaterial = new THREE.MeshStandardMaterial({ color: color });
    
    const leftArm = new THREE.Mesh(armGeometry, armMaterial);
    leftArm.position.set(-0.4, 0.5, 0);
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeometry, armMaterial);
    rightArm.position.set(0.4, 0.5, 0);
    group.add(rightArm);

    // Legs
    const legGeometry = new THREE.BoxGeometry(0.18, 0.4, 0.18);
    const legMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 }); // Pants/shoes
    
    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(-0.15, 0.2, 0);
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(0.15, 0.2, 0);
    group.add(rightLeg);

    return group;
}

// 2. Local Player (The Character)
const cube = createCharacter(0x00ff00);
scene.add(cube);

// 2.5 Add Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 50);
pointLight.position.set(5, 5, 5);
scene.add(pointLight);

// Position camera back so we can see the cube
camera.position.z = 5;

// 3. Movement Logic Variables
const moveSpeed = 0.05;
const keys = {};

// Jump Variables
let yVelocity = 0;
const gravity = 0.01;
const jumpStrength = 0.2;
let isJumping = false;

// Track key states
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;

    if (e.code === 'Space' && !isJumping) {
        yVelocity = jumpStrength;
        isJumping = true;
    }
});
window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Dictionary to store other players
const otherPlayers = {};
const infoDiv = document.getElementById('info');

// Helper to update player count UI
function updatePlayerCount() {
    const count = Object.keys(otherPlayers).length + 1; // +1 for the local player
    infoDiv.innerHTML = `
        <div style="font-weight: bold;">Multiplayer Cube World</div>
        <div style="color: #4CAF50;">Players Online: ${count}</div>
        <p style="font-size: 12px; margin: 5px 0;">Arrows: Move | Space: Jump</p>
    `;
}

// Helper to create a character for other players
function createOtherPlayerCube(id, position) {
    if (otherPlayers[id]) return; // Safety check
    
    console.log("Creating character for player:", id);
    const otherCube = createCharacter(0xff0000); // Red character for others
    otherCube.position.set(position.x, position.y, position.z);
    scene.add(otherCube);
    otherPlayers[id] = otherCube;
    updatePlayerCount();
}

// Socket Events - Wrap in 'connect' to ensure socket.id is ready
socket.on('connect', () => {
    console.log("Connected to server with ID:", socket.id);
    updatePlayerCount();

    socket.on('currentPlayers', (players) => {
        Object.keys(players).forEach((id) => {
            if (id !== socket.id && !otherPlayers[id]) {
                createOtherPlayerCube(id, players[id].position);
            }
        });
    });

    socket.on('newPlayer', (playerInfo) => {
        if (playerInfo.id !== socket.id && !otherPlayers[playerInfo.id]) {
            createOtherPlayerCube(playerInfo.id, playerInfo.position);
        }
    });

    socket.on('playerMoved', (playerInfo) => {
        if (otherPlayers[playerInfo.id]) {
            otherPlayers[playerInfo.id].position.set(playerInfo.position.x, playerInfo.position.y, playerInfo.position.z);
            otherPlayers[playerInfo.id].rotation.set(playerInfo.rotation.x, playerInfo.rotation.y, 0);
        }
    });

    socket.on('playerDisconnected', (id) => {
        if (otherPlayers[id]) {
            console.log("Player disconnected:", id);
            scene.remove(otherPlayers[id]);
            delete otherPlayers[id];
            updatePlayerCount();
        }
    });
});

// Track last emitted position to avoid redundant updates
let lastPosition = { x: 0, y: 0, z: 0 };
let lastRotation = { x: 0, y: 0 };

// 5. Animation Loop
function animate() {
    requestAnimationFrame(animate);

    // Horizontal & Depth Movement
    let moved = false;
    let dx = 0;
    let dz = 0;
    
    if (keys['ArrowUp']) { dz -= 1; moved = true; }
    if (keys['ArrowDown']) { dz += 1; moved = true; }
    if (keys['ArrowLeft']) { dx -= 1; moved = true; }
    if (keys['ArrowRight']) { dx += 1; moved = true; }

    if (moved) {
        // Normalize movement vector to ensure consistent speed in all directions
        const length = Math.sqrt(dx * dx + dz * dz);
        if (length > 0) {
            cube.position.x += (dx / length) * moveSpeed;
            cube.position.z += (dz / length) * moveSpeed;
            // Face the exact direction of movement
            cube.rotation.y = Math.atan2(dx, dz);
        }
    }

    // Jump Physics
    if (isJumping) {
        cube.position.y += yVelocity;
        yVelocity -= gravity;
        moved = true;

        if (cube.position.y <= 0) {
            cube.position.y = 0;
            isJumping = false;
            yVelocity = 0;
        }
    }

    // Emit movement to server if position or rotation changed
    if (moved || cube.rotation.y !== lastRotation.y) {
        socket.emit('playerMovement', {
            position: { x: cube.position.x, y: cube.position.y, z: cube.position.z },
            rotation: { x: cube.rotation.x, y: cube.rotation.y }
        });
        lastPosition = { x: cube.position.x, y: cube.position.y, z: cube.position.z };
        lastRotation = { x: cube.rotation.x, y: cube.rotation.y };
    }

    renderer.render(scene, camera);
}

// 6. Handle Window Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start the animation
animate();