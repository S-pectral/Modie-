// ==UserScript==
// @name         MODIE: Super Another (Legit & Stealth)
// @namespace    http://tampermonkey.net/
// @version      3.6
// @description  Features +  Stability (Ghost Fix & Smooth Bhop)
// @author       Spectral.
// @match        *://krunker.io/*
// @match        *://browserfps.com/*
// @exclude      *://krunker.io/social*
// @exclude      *://krunker.io/editor*
// @icon         https://www.google.com/s2/favicons?domain=krunker.io
// @grant        none
// @run-at       document-start
// @require      https://unpkg.com/three@0.150.0/build/three.min.js
// ==/UserScript==

// --- CONFIG ---
const THREE = window.THREE;
try { delete window.THREE; } catch (e) { }

const settings = {
    aimbotEnabled: false,
    aimbotOnRightMouse: false,
    aimbotWallCheck: true,
    espEnabled: true,
    espLines: false,
    espNames: true,
    chams: true,
    wireframe: false,
    humanize: true,
    smoothSpeed: 0.2,
    fovCircle: true
};

const keyToSetting = {
    'KeyB': 'aimbotEnabled',
    'KeyL': 'chams',
    'KeyM': 'espEnabled',
    'KeyN': 'espLines',
    'KeyK': 'wireframe',
    'KeyP': 'spinbot',
    'KeyO': 'thirdPerson',
    // 'KeyI' removed to prevent menu conflict
    'KeyT': 'autoReload',
    'KeyH': 'humanize',
    'Numpad5': 'aimbotWallCheck',
    'Backquote': 'toggleMenu',
    'Digit9': 'fovCircle',
    'KeyJ': 'espNames',
    'KeyU': 'aimbotOnRightMouse'
};









// Fallback/Alternative hook (often scene is pushed to window.renderer.scene)
// We rely on standard animate Loop.


// ...

// Helper for Smooth Angle Interpolation
function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}
function lerpAngle(start, end, amt) {
    let cs = Math.cos(start), ss = Math.sin(start);
    let ce = Math.cos(end), se = Math.sin(end);
    let diff = Math.acos(cs * ce + ss * se);
    if (Math.sin(end - start) < 0) diff = -diff;
    // If diff is huge, just snap (optional, but cleaner lerp below)
    return start + diff * amt;
}

// Reverse map
const settingToKeyDisplay = {};
for (let k in keyToSetting) {
    if (keyToSetting[k] !== 'toggleMenu') settingToKeyDisplay[keyToSetting[k]] = k.replace('Key', '');
}

// --- MENU ---
const menuCSS = `
    .modie-menu {
        position: fixed; top: 10px; right: 10px; width: auto; min-width: 200px;
        background: rgba(10, 10, 15, 0.95); border: 1px solid #00ff88;
        border-radius: 6px; color: #eee; font-family: 'Consolas', sans-serif;
        box-shadow: 0 0 10px rgba(0, 255, 136, 0.2); z-index: 9999999;
        display: none; padding: 10px; user-select: none; font-size: 11px;
    }
    .modie-header { font-size: 13px; font-weight: bold; color: #00ff88; border-bottom: 1px solid #00ff88; padding-bottom: 5px; margin-bottom: 8px; text-align: center; }
    .modie-item { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; padding: 3px; cursor: pointer; border-radius: 3px; }
    .modie-item:hover { background: rgba(0, 255, 136, 0.15); }
    .modie-key { color: #888; font-size: 10px; margin-right: 8px; width: 60px; text-align: right; }
    .on { color: #00ff88; } .off { color: #ff5555; }
    .footer { text-align: center; color: #666; margin-top: 5px; font-size: 9px; }
`;

function createGUI() {
    const style = document.createElement('style'); style.innerHTML = menuCSS; document.head.appendChild(style);
    const gui = document.createElement('div'); gui.className = 'modie-menu';
    gui.innerHTML = `<div class="modie-header" id="modie-header">MODIE V3.6</div><div id="modie-content"></div><div class="footer">[F1] or ["] (Esc Under) to Hide</div>`;
    document.body.appendChild(gui); renderItems(gui.querySelector('#modie-content')); return gui;
}

function renderItems(container) {
    container.innerHTML = '';
    for (const key in settings) {
        // if (key === 'aimbotOnRightMouse') continue; // Hidden line removed
        const item = document.createElement('div'); item.className = 'modie-item';
        item.onclick = () => { settings[key] = !settings[key]; renderItems(container); };
        const keyBind = settingToKeyDisplay[key] ? `[${settingToKeyDisplay[key]}]` : '';
        // If smoothSpeed (Float), use special display
        if (key === 'smoothSpeed') {
            item.innerHTML = `<span class="modie-key"></span><span style="flex-grow:1">Smoothness</span><span class="modie-val on">${settings[key].toFixed(2)}</span>`;
            item.onclick = () => {
                let v = settings.smoothSpeed + 0.1;
                if (v > 1.0) v = 0.1;
                settings.smoothSpeed = v;
                renderItems(container);
            };
        } else {
            item.innerHTML = `<span class="modie-key">${keyBind}</span><span style="flex-grow:1">${formatName(key)}</span><span class="modie-val ${settings[key] ? 'on' : 'off'}">${settings[key] ? 'ON' : 'OFF'}</span>`;
        }
        container.appendChild(item);
    }
}
function formatName(str) { return str.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()); }
function updatePlayerCount(count) {
    const el = document.getElementById('modie-header');
    if (el) {
        if (!scene) el.innerHTML = `MODIE V3.6 <span style="color:#ff5555;">(Injecting...)</span>`;
        else el.innerHTML = `MODIE V3.6 <span style="color:#fff; font-size:10px;">(Players: ${count})</span>`;
    }
}

// --- HOOKS ---
let scene = null;

// 1. Array Push Hook (Passive)
const originalPush = Array.prototype.push;
Array.prototype.push = function (object) {
    try {
        if (object && object.parent && object.parent.type === 'Scene' && object.parent.name === 'Main') {
            scene = object.parent;
        }
    } catch (e) { }
    return originalPush.apply(this, arguments);
};

// 2. Render Hook (Aggressive - from AimbaeShiro)
const originalCall = Function.prototype.call;
Function.prototype.call = function (...args) {
    if (!scene && args[1] && args[1].isScene && args[2] && args[2].isCamera) {
        scene = args[1];
        console.log("MODIE: Scene Captured via Render Hook!");
    }
    return originalCall.apply(this, arguments);
};

// --- GRAPHICS ---
const tempVector = new THREE.Vector3();
const tempObject = new THREE.Object3D(); tempObject.rotation.order = 'YXZ';
const COL_ENEMY = 0xff0055;
const COL_TEAM = 0x00aaff;
const espMap = new Map();

const boxGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(5, 15, 5).translate(0, 7.5, 0));
const boxMatEnemy = new THREE.LineBasicMaterial({ color: COL_ENEMY, depthTest: false, depthWrite: false, transparent: true, opacity: 0.9 });
const boxMatTeam = new THREE.LineBasicMaterial({ color: COL_TEAM, depthTest: false, depthWrite: false, transparent: true, opacity: 0.5 });

const lineMat = new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, depthWrite: false, transparent: true, opacity: 0.6 });
const line = new THREE.LineSegments(new THREE.BufferGeometry(), lineMat);
line.frustumCulled = false; line.renderOrder = 9999;
const MAX_LINES = 200;
const linePositions = new THREE.BufferAttribute(new Float32Array(MAX_LINES * 2 * 3), 3);
const lineColors = new THREE.BufferAttribute(new Float32Array(MAX_LINES * 2 * 3), 3);
line.geometry.setAttribute('position', linePositions);
line.geometry.setAttribute('color', lineColors);

// --- UTIL ---
function createTextSprite(text, isTeam) {
    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
    ctx.font = '900 40px Arial'; const width = ctx.measureText(text).width + 20;
    canvas.width = width; canvas.height = 50;
    ctx.lineWidth = 4; ctx.strokeStyle = "black";
    ctx.fillStyle = isTeam ? "#00aaff" : "#ff0055";
    ctx.strokeText(text, 10, 38); ctx.fillText(text, 10, 38);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, transparent: true }));
    sprite.scale.set(width / 5, 8, 1); sprite.renderOrder = 9999;
    return sprite;
}

function hasCamera(obj) {
    if (obj.type === 'PerspectiveCamera') return true;
    if (obj.children) for (let i = 0; i < obj.children.length; i++) if (hasCamera(obj.children[i])) return true;
    return false;
}

function toScreenPosition(obj, camera, width, height) {
    const pos = obj.position.clone();
    pos.project(camera);
    return { x: (pos.x * .5 + .5) * width, y: -(pos.y * .5 - .5) * height, z: pos.z };
}

// Bounding Box Check for Ghost Filtering
const tempBox = new THREE.Box3();
const tempSize = new THREE.Vector3();
function isValidPlayer(obj) {
    if (!obj.geometry && obj.children.length === 0) return false;

    // Check Dimensions
    tempBox.setFromObject(obj);
    tempBox.getSize(tempSize);

    // Krunker Player Height is roughly 11-13 units
    // Min Height 7.5 helps filter small props/sprays without being too strict
    // Lowered to 4.5 to catch crouched players
    if (tempSize.y < 4.5 || tempSize.y > 25) return false;
    if (tempSize.x < 1.5 || tempSize.z < 1.5) return false; // Too thin

    return true;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }



// --- ANIMATE ---
let guiEl = null;
let fovCircle = null;
let targetPlayer = null; // GLOBAL PERSISTENCE FOR LOCKING

function animate() {
    window.requestAnimationFrame(animate);
    if (!document.body) return; // Wait for body to load
    if (!guiEl) guiEl = createGUI();
    if (!scene) return;

    // --- FOV CIRCLE ---
    if (!fovCircle) {
        fovCircle = document.getElementById('modie-fov');
        if (!fovCircle && document.body) {
            const fovSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            fovSvg.id = 'modie-fov';
            fovSvg.style.position = 'fixed'; fovSvg.style.top = '0'; fovSvg.style.left = '0';
            fovSvg.style.width = '100%'; fovSvg.style.height = '100%';
            fovSvg.style.pointerEvents = 'none'; fovSvg.style.zIndex = '999999';
            fovSvg.innerHTML = `<circle cx="50%" cy="50%" r="150" stroke="#00ff88" stroke-width="2" fill="none" opacity="0.5"/>`;
            document.body.appendChild(fovSvg);
            fovCircle = fovSvg;
        }
    }
    if (fovCircle) fovCircle.style.display = settings.aimbotEnabled ? 'block' : 'none';

    const players = [];
    let myPlayer = null;

    // Filter Step
    for (const child of scene.children) {
        if (child.type === 'Object3D') {
            try {
                if (hasCamera(child)) myPlayer = child;
                else {
                    // FILTER: Only add if it looks like a player
                    if (isValidPlayer(child)) {
                        players.push(child);
                    }
                }
            } catch (e) { }
        }
    }
    updatePlayerCount(players.length);
    if (!myPlayer) return;

    if (line.parent !== scene) scene.add(line);
    const cam = myPlayer.children[0]?.children[0];

    // --- ROBUST TEAM DETECTION ---
    let myTeam = myPlayer.team;
    if (myTeam === undefined && myPlayer.userData && myPlayer.userData.team !== undefined) myTeam = myPlayer.userData.team;
    if (myTeam === undefined && myPlayer.props && myPlayer.props.team !== undefined) myTeam = myPlayer.props.team; // Common obfuscation

    // Fallback: Global Game Activity (Reliable in recent patches)
    if (myTeam === undefined && window.getGameActivity) {
        const activity = window.getGameActivity();
        if (activity && activity.team !== undefined) myTeam = activity.team;
    }

    // Persistence
    if (myTeam === undefined && window.lastKnownTeam !== undefined) myTeam = window.lastKnownTeam;
    else if (myTeam !== undefined) {
        if (window.lastKnownTeam !== myTeam) console.log("MODIE: Team Detected ->", myTeam);
        window.lastKnownTeam = myTeam;
    }





    // --- SPINBOT ---
    if (settings.spinbot) {
        const time = Date.now() / 100;
        myPlayer.rotation.y = time % (Math.PI * 2);
    }

    // --- THIRD PERSON (FIXED) ---
    if (cam) {
        if (settings.thirdPerson) {
            // Apply to the camera object directly
            // Positive Z in ThreeJS camera space = Backwards
            cam.position.z = 25;
            cam.position.y = 5;
            cam.position.x = 0;

        } else {
            // Only reset if we are significantly off (avoid fighting animation if minor)
            if (cam.position.z > 2) {
                cam.position.set(0, 0, 0);
            }
        }
    }

    // --- LOCAL WEAPON CHAMS ---
    if (cam) {
        if (settings.chams) {
            cam.traverse(child => {
                if (child.isMesh && child.material) {
                    child.material.depthTest = false;
                    child.material.transparent = true;
                    child.material.opacity = 0.5;
                    child.material.wireframe = settings.wireframe;
                    child.material.color?.setHex(0x00ff88);
                }
            });
        }

    }



    let counter = 0;
    let minWorldDist = Infinity; // Track Closest Distance
    const screenCenter = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    // --- TARGET VALIDATION (STICKY AIM) ---
    if (targetPlayer) {
        let valid = true;
        if (!targetPlayer.parent) valid = false;
        if (valid && targetPlayer.health <= 0) valid = false;

        // Explicit Teammate Check (Double Safety)
        if (valid && myTeam != null && targetPlayer.team != null && targetPlayer.team == myTeam) valid = false;

        if (valid && cam) {
            const screenPos = toScreenPosition(targetPlayer, cam, window.innerWidth, window.innerHeight);
            if (screenPos.z < 1) {
                const dist = Math.sqrt(Math.pow(screenPos.x - screenCenter.x, 2) + Math.pow(screenPos.y - screenCenter.y, 2));
                if (dist > 150) valid = false; // Lost lock (out of FOV)
            } else valid = false; // Behind us
        }
        if (!valid) targetPlayer = null;
    }

    tempObject.matrix.copy(myPlayer.matrix).invert();
    const activePlayerSet = new Set();

    for (const player of players) {
        activePlayerSet.add(player.uuid);
        const isTeammate = (myTeam != null && player.team != null && player.team == myTeam);

        // --- CHAMS & MATERIAL MANAGER ---
        player.traverse((child) => {
            if (child.isMesh && child.material) {
                // If Chams or Wireframe is enabled, we override
                if (settings.chams || settings.wireframe) {
                    if (settings.wireframe) child.material.wireframe = true;
                    if (settings.chams) {
                        child.material.depthTest = false;  // Wallhack visibility
                        child.material.fog = false;        // Bright
                        child.material.transparent = true;
                        child.material.opacity = 0.6;      // Ghostly
                    }

                    // Team Color
                    if (isTeammate) child.material.emissive?.setHex(COL_TEAM);
                    else child.material.emissive?.setHex(COL_ENEMY);

                    // Apply immediate color tint if possible
                    child.material.color?.setHex(isTeammate ? COL_TEAM : COL_ENEMY);

                } else {
                    // RESET State
                    if (child.material.wireframe) child.material.wireframe = false;
                    if (child.material.depthTest === false) child.material.depthTest = true;
                    if (child.material.fog === false) child.material.fog = true;
                    if (child.material.opacity !== 1.0) {
                        child.material.transparent = false;
                        child.material.opacity = 1.0;
                    }
                    child.material.emissive?.setHex(0x000000);
                    child.material.color?.setHex(0xffffff);
                }
            }
        });

        // --- ESP ---
        let espData = espMap.get(player.uuid);
        if (!espData) {
            const group = new THREE.Group();
            const box = new THREE.LineSegments(boxGeo, boxMatEnemy);
            box.frustumCulled = false; box.renderOrder = 9999;
            group.add(box); scene.add(group);
            espData = { group, box, sprite: null };
            espMap.set(player.uuid, espData);
        }

        if (espData.group) {
            espData.group.position.copy(player.position);
            espData.group.rotation.y = player.rotation.y;

            if (player === myPlayer || (player.position.x === myPlayer.position.x && player.position.z === myPlayer.position.z)) {
                espData.group.visible = false;
            } else {
                espData.group.visible = settings.espEnabled;
                espData.box.material = isTeammate ? boxMatTeam : boxMatEnemy;

                if (settings.espNames && settings.espEnabled) {
                    const dist = Math.round(player.position.distanceTo(myPlayer.position));

                    // Attempt to get Name and Health
                    let name = player.name || (player.userData && player.userData.name) || "Enemy";
                    if (name.length > 10) name = name.substring(0, 10); // Truncate

                    let hp = (player.health !== undefined) ? player.health : (player.userData && player.userData.health) || 100;

                    const textContent = `${name} [${hp}] [${dist}m]`;

                    if (!espData.sprite || espData.sprite.isTeam !== isTeammate || espData.lastText !== textContent) {
                        if (espData.sprite) espData.group.remove(espData.sprite);
                        espData.sprite = createTextSprite(textContent, isTeammate);
                        espData.sprite.isTeam = isTeammate;
                        espData.sprite.position.y = 20;
                        espData.group.add(espData.sprite);
                        espData.lastText = textContent;
                    }
                    if (espData.sprite) espData.sprite.visible = true;
                } else if (espData.sprite) {
                    espData.sprite.visible = false;
                }
            }
        }

        // --- LINES ---
        // DRAW IN WORLD SPACE (Line is attached to Scene)
        if (settings.espLines && settings.espEnabled && !isTeammate) {
            if (counter >= MAX_LINES) continue; // Prevent Buffer Overflow
            const startX = myPlayer.position.x;
            const startY = myPlayer.position.y - 4;
            const startZ = myPlayer.position.z;

            const endX = player.position.x;
            const endY = player.position.y + 6;
            const endZ = player.position.z;

            // CRITICAL FIX: Only add if coordinates are valid numbers
            if (Number.isFinite(startX) && Number.isFinite(startY) && Number.isFinite(startZ) &&
                Number.isFinite(endX) && Number.isFinite(endY) && Number.isFinite(endZ)) {

                const color = new THREE.Color(COL_ENEMY);

                linePositions.setXYZ(counter, startX, startY, startZ);
                lineColors.setXYZ(counter, color.r, color.g, color.b);
                counter++;

                linePositions.setXYZ(counter, endX, endY, endZ);
                lineColors.setXYZ(counter, color.r, color.g, color.b);
                counter++;
            }
        }

        // --- AIMBOT SCANNING ---
        // Only look for new target if we don't have one
        if (!targetPlayer) {
            if (!isTeammate) {
                // Wall Check (Simple Visibility Check - REVERTED)
                if (settings.aimbotWallCheck && !player.visible) {
                    continue; // Skip if wall check is on and player is not visible
                }

                if (cam) {
                    const screenPos = toScreenPosition(player, cam, window.innerWidth, window.innerHeight);
                    if (screenPos.z < 1) {
                        const distToCrosshair = Math.sqrt(Math.pow(screenPos.x - screenCenter.x, 2) + Math.pow(screenPos.y - screenCenter.y, 2));

                        // VALID FOV
                        if (distToCrosshair < 150) {
                            // PRIORITY: CROSSHAIR DISTANCE (Focus on who I'm looking at)
                            // User Request: "önümde görünür adam varken duvar arkasındakine kilitlenmesin"
                            // Solution: Use Screen Distance instead of World Distance.
                            let score = distToCrosshair;

                            // Penalty for being behind wall (if detected)
                            if (!player.visible) score += 500;

                            if (score < minWorldDist) {
                                minWorldDist = score;
                                targetPlayer = player;
                            }
                        }
                    }
                }
            }
        }
    }

    for (const [uuid, data] of espMap) {
        if (!activePlayerSet.has(uuid)) {
            scene.remove(data.group);
            espMap.delete(uuid);
        }
    }

    if (settings.espLines && settings.espEnabled && counter > 0) {
        line.geometry.setDrawRange(0, counter);
        linePositions.needsUpdate = true; lineColors.needsUpdate = true;
        line.visible = true;
    } else { line.visible = false; }



    // --- AIMBOT ---
    // --- AIMBOT APPLICATION ---
    if (settings.aimbotEnabled && targetPlayer) {
        // If "On Right Mouse" is enabled, we ONLY proceed if right mouse is held
        // BUT user wants Auto Scope to trigger via this too.
        // User Request: "eğer yeşil çemberin içinde biri varsa otomatik nişan alsın"
        // So: If autoScope is ON and targetPlayer exists, WE MUST AIM.

        const shouldAim = !settings.aimbotOnRightMouse || rightMouseDown || (settings.autoScope && targetPlayer);

        if (shouldAim) {
            // Get Camera (Eye) Position
            const cam = myPlayer.children[0]?.children[0];
            const targetHead = targetPlayer.children[0]?.children[0];

            if (cam) {
                // Get World Positions
                if (targetHead) {
                    // Use actual Head Matrix for animations (crouch/jump) - FIX: Use matrixWorld
                    tempVector.setFromMatrixPosition(targetHead.matrixWorld);
                    // Add small offset to hit center of head instead of neck/base
                    tempVector.y += 2.0;
                } else {
                    // Fallback to position estimation
                    tempVector.copy(targetPlayer.position);
                    tempVector.y += 11;
                }

                const camPos = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);

                // Calculate Angles
                const deltaX = tempVector.x - camPos.x;
                const deltaY = tempVector.y - camPos.y;
                const deltaZ = tempVector.z - camPos.z;
                const dist = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);

                const targetPitch = Math.atan2(deltaY, dist);
                const targetYaw = Math.atan2(deltaX, deltaZ) + Math.PI;

                // Apply Rotation (Humanized vs Instant)
                const speed = settings.smoothSpeed || 0.2;
                myPlayer.rotation.y = lerpAngle(myPlayer.rotation.y, targetYaw, speed);
                myPlayer.children[0].rotation.x = lerp(myPlayer.children[0].rotation.x, targetPitch, speed);

                // --- AUTO SCOPE (Only when locked/aiming) ---
                if (settings.autoScope && !rightMouseDown) {
                }
            }
        }
    }

    // --- AUTO RELOAD ---
    if (settings.autoReload) {
        // Check multiple common IDs for Krunker Ammo display
        const ammoEl = document.getElementById('ammoVal') ||
            document.getElementById('ammoDisplay') ||
            document.getElementById('currentAmmo') ||
            document.getElementById('ammo');

        if (ammoEl) {
            const ammoText = ammoEl.innerText || '';
            const ammo = parseInt(ammoText);

            // User Request: "mermim az iken 10 merminin altında ise"
            if (!isNaN(ammo) && ammo < 10) {
                // Safety: Don't reload if we have a locked target (active combat) unless empty?
                // User said: "if near me no man and ammo low"
                // We check !targetPlayer (Safe)
                if (!targetPlayer) {
                    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }));
                    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyR' }));
                }
            }
        }
    }
}

// --- INPUTS ---
let rightMouseDown = false;
const keysPressed = {};

// Use Capture Phase
window.addEventListener('mousedown', e => { if (e.button === 2) rightMouseDown = true; }, true);
window.addEventListener('mouseup', e => { if (e.button === 2) rightMouseDown = false; }, true);

function dispatchMouseEvent(type, button) {
    const target = document.querySelector('#gameCanvas') || document.querySelector('canvas') || document.body;

    // Create standard MouseEvent
    const mouseEvent = new MouseEvent(type, {
        bubbles: true, cancelable: true, view: window,
        button: button, buttons: button === 0 ? 1 : 2,
        clientX: window.innerWidth / 2, clientY: window.innerHeight / 2,
        screenX: window.innerWidth / 2, screenY: window.innerHeight / 2
    });

    target.dispatchEvent(mouseEvent);

    // Krunker (and modern games) use Pointer Events
    // We must simulate this parallel to MouseEvent
    const pointerEvent = new PointerEvent(type.replace('mouse', 'pointer'), {
        bubbles: true, cancelable: true, view: window,
        button: button, buttons: button === 0 ? 1 : 2,
        clientX: window.innerWidth / 2, clientY: window.innerHeight / 2,
        pointerId: 1, pointerType: 'mouse', isPrimary: true
    });

    target.dispatchEvent(pointerEvent);
}

document.addEventListener('keydown', e => {
    keysPressed[e.code] = true;
    if (keyToSetting[e.code] || e.code === 'F1') {
        const m = document.querySelector('.modie-menu');

        // Always allow Menu Toggle (F1 / Backquote [TR "])
        if (e.code === 'F1' || e.code === 'Backquote') {
            e.preventDefault();
            e.stopPropagation();
            if (m) {
                // Check computed style to see if hidden by CSS class or inline
                const computed = window.getComputedStyle(m).display;
                m.style.display = computed === 'none' ? 'block' : 'none';
                console.log("Menu Toggle:", m.style.display);
            }
        }
        // Only allow other hotkeys if Menu is VISIBLE (V3.6 Behavior)
        else if (m) {
            const computed = window.getComputedStyle(m).display;
            if (computed !== 'none') {
                settings[keyToSetting[e.code]] = !settings[keyToSetting[e.code]];
                if (document.querySelector('#modie-content')) renderItems(document.querySelector('#modie-content'));
            }
        }
    }
}, true);
window.addEventListener('keyup', e => { keysPressed[e.code] = false; });

animate();