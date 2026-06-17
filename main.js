import * as THREE from 'three';
import { io } from 'socket.io-client';

// 0. Connect to the multiplayer server
const socket = io('http://localhost:3000');

// 1. Setup Scene, Camera, and Renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 2. Local Player (The Cube)
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// Dictionary to store other players
const otherPlayers = {};

// Helper to create a cube for other players
function createOtherPlayerCube(id, position) {
    const otherGeometry = new THREE.BoxGeometry(1, 1, 1);
    const otherMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 }); // Different color for others
    const otherCube = new THREE.Mesh(otherGeometry, otherMaterial);
    otherCube.position.set(position.x, position.y, position.z);
    scene.add(otherCube);
    otherPlayers[id] = otherCube;
}

// Socket Events
socket.on('currentPlayers', (players) => {
    Object.keys(players).forEach((id) => {
        if (id !== socket.id && !otherPlayers[id]) {
            createOtherPlayerCube(id, players[id].position);
        }
    });
});

socket.on('newPlayer', (playerInfo) => {
    // Only create a cube if it's NOT the local player and doesn't exist yet
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
        scene.remove(otherPlayers[id]);
        delete otherPlayers[id];
    }
});

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

// 4. Update UI Info
const infoDiv = document.getElementById('info');
infoDiv.innerHTML = `
    <div>Multiplayer Three.js Cube</div>
    <p style="font-size: 12px; margin: 5px 0;">Arrows: Move | Space: Jump</p>
`;

// Track last emitted position to avoid redundant updates
let lastPosition = { x: 0, y: 0, z: 0 };
let lastRotation = { x: 0, y: 0 };

// 5. Animation Loop
function animate() {
    requestAnimationFrame(animate);

    // Standard rotation for local cube
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;

    // Horizontal & Depth Movement
    let moved = false;
    if (keys['ArrowUp']) { cube.position.z -= moveSpeed; moved = true; }
    if (keys['ArrowDown']) { cube.position.z += moveSpeed; moved = true; }
    if (keys['ArrowLeft']) { cube.position.x -= moveSpeed; moved = true; }
    if (keys['ArrowRight']) { cube.position.x += moveSpeed; moved = true; }

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
    if (moved || cube.rotation.x !== lastRotation.x || cube.rotation.y !== lastRotation.y) {
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