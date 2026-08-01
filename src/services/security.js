const hexToUint8Array = (hexStr) => {
    const r = hexStr.match(/.{1,2}/g);
    if (!r) return null;
    return new Uint8Array(r.map((b) => parseInt(b, 16)));
};

const uint8ArrayToHex = (arr) =>
    arr.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');

const SALT_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 256;

/**
 * Derives an AES-256-GCM key from a password using PBKDF2 with a random salt.
 * @param {string} password
 * @param {Uint8Array} [salt] - Optional; if omitted, a new random salt is generated.
 * @returns {{ key: CryptoKey, salt: Uint8Array, keyHex: string }}
 */
async function deriveKey(password, salt) {
    const encoder = new TextEncoder();
    const saltBytes = salt || window.crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

    const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    const key = await window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: saltBytes,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: KEY_LENGTH },
        true,
        ['encrypt', 'decrypt']
    );

    // Export key as raw bytes for hex representation (needed for compatibility)
    const rawKey = await window.crypto.subtle.exportKey('raw', key);
    const keyHex = uint8ArrayToHex(new Uint8Array(rawKey));

    return { key, salt: saltBytes, keyHex };
}

/**
 * Encrypts plaintext using AES-256-GCM with a PBKDF2-derived key.
 * Output format: salt (hex) + iv (hex) + ciphertext (hex)
 * @param {string} plaintext
 * @param {string} password
 * @returns {Promise<string>} hex-encoded: salt (32 chars) + iv (24 chars) + ciphertext
 */
async function encrypt(plaintext, password) {
    const { key, salt } = await deriveKey(password);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const cipher = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(plaintext)
    );

    const ciphertext = new Uint8Array(cipher);
    const result = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
    result.set(salt, 0);
    result.set(iv, salt.length);
    result.set(ciphertext, salt.length + iv.length);

    return uint8ArrayToHex(result);
}

/**
 * Decrypts ciphertext that was encrypted by the encrypt function above.
 * @param {string} ciphertext - hex-encoded: salt (32 chars) + iv (24 chars) + ciphertext
 * @param {string} password
 * @returns {Promise<string>}
 */
async function decrypt(ciphertext, password) {
    const text = hexToUint8Array(ciphertext);
    if (!text) return '';
    if (text.length < SALT_LENGTH + 12 + 1) {
        // Legacy support: ciphertext without salt (old format)
        return legacyDecrypt(ciphertext, password);
    }

    const salt = text.slice(0, SALT_LENGTH);
    const iv = text.slice(SALT_LENGTH, SALT_LENGTH + 12);
    const data = text.slice(SALT_LENGTH + 12);

    const { key } = await deriveKey(password, salt);

    const plaintext = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        data
    );

    return new TextDecoder().decode(new Uint8Array(plaintext));
}

/**
 * Legacy decrypt for ciphertexts encrypted with the old stdAESKey approach.
 * @param {string} ciphertext
 * @param {string} key
 * @returns {Promise<string>}
 */
async function legacyDecrypt(ciphertext, key) {
    const defaultAESKey = new TextEncoder().encode(
        'https://github.com/pypy-vrc/VRCX'
    );

    function stdAESKey(pwd) {
        const tKey = new TextEncoder().encode(pwd);
        let sk = tKey;
        if (tKey.length < 32) {
            sk = new Uint8Array(32);
            sk.set(tKey);
            sk.set(defaultAESKey.slice(pwd.length, 32), pwd.length);
        }
        return sk.slice(0, 32);
    }

    const text = hexToUint8Array(ciphertext);
    if (!text) return '';

    const sharedKey = await window.crypto.subtle.importKey(
        'raw',
        stdAESKey(key),
        { name: 'AES-GCM', length: 256 },
        true,
        ['decrypt']
    );

    const plaintext = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: text.slice(0, 12) },
        sharedKey,
        text.slice(12)
    );

    return new TextDecoder().decode(new Uint8Array(plaintext));
}

export default {
    decrypt,
    encrypt
};

export { hexToUint8Array, uint8ArrayToHex };
