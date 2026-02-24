//! AnimeKai native encryption/decryption
//! Position-dependent substitution cipher with 183 tables.

use crate::animekai_tables::{ENCRYPT, NUM_TABLES};
use anyhow::{Result, bail};
use base64::Engine;

const HEADER: [u8; 21] = [
    0xc5, 0x09, 0xbd, 0xb4, 0x97, 0xcb, 0xc0, 0x68, 0x73, 0xff,
    0x41, 0x2a, 0xf1, 0x2f, 0xd8, 0x00, 0x76, 0x24, 0xc2, 0x9f, 0xaa,
];

const CONSTANT_BYTES: [(usize, u8); 13] = [
    (1, 0xf2), (2, 0xdf), (3, 0x9b), (4, 0x9d), (5, 0x16), (6, 0xe5),
    (8, 0x67), (9, 0xc9), (10, 0xdd),
    (12, 0x9c),
    (14, 0x29),
    (16, 0x35),
    (18, 0xc8),
];

fn cipher_pos(plain_pos: usize) -> usize {
    match plain_pos {
        0 => 0,
        1 => 7,
        2 => 11,
        3 => 13,
        4 => 15,
        5 => 17,
        6 => 19,
        n => 20 + (n - 7),
    }
}

fn url_safe_b64_decode(s: &str) -> Result<Vec<u8>> {
    // Replace URL-safe chars with standard base64 chars
    let std = s.replace('-', "+").replace('_', "/");
    // Add padding
    let padded = match std.len() % 4 {
        0 => std,
        2 => format!("{}==", std),
        3 => format!("{}=", std),
        _ => std,
    };
    // Use lenient decoder (allows non-canonical trailing bits like Node.js)
    use base64::engine::{GeneralPurpose, GeneralPurposeConfig, DecodePaddingMode};
    use base64::alphabet::STANDARD;
    let lenient = GeneralPurpose::new(
        &STANDARD,
        GeneralPurposeConfig::new()
            .with_decode_padding_mode(DecodePaddingMode::Indifferent)
            .with_decode_allow_trailing_bits(true),
    );
    lenient
        .decode(padded.as_bytes())
        .map_err(|e| anyhow::anyhow!("b64 decode: {e} (len={})", s.len()))
}

fn url_safe_b64_encode(data: &[u8]) -> String {
    base64::engine::general_purpose::STANDARD
        .encode(data)
        .replace('+', "-")
        .replace('/', "_")
        .trim_end_matches('=')
        .to_string()
}

/// Build reverse (decrypt) table for a given position: byte -> char
fn build_decrypt_table(pos: usize) -> [u8; 256] {
    let mut rev = [0xFFu8; 256];
    if pos < NUM_TABLES {
        for ascii in 0u8..128 {
            let enc = ENCRYPT[pos][ascii as usize];
            if enc != 0xFF {
                rev[enc as usize] = ascii;
            }
        }
    }
    rev
}

pub fn encrypt(plaintext: &str) -> Result<String> {
    if plaintext.is_empty() {
        bail!("empty plaintext");
    }
    let bytes = plaintext.as_bytes();
    if bytes.len() > NUM_TABLES {
        bail!("plaintext too long ({} > {})", bytes.len(), NUM_TABLES);
    }

    let max_cp = cipher_pos(bytes.len() - 1);
    let enc_block_len = max_cp + 1;
    let total = 21 + enc_block_len;
    let mut cipher = vec![0u8; total];

    // Header
    cipher[..21].copy_from_slice(&HEADER);

    // Constant padding bytes
    for &(pos, val) in &CONSTANT_BYTES {
        if pos < enc_block_len {
            cipher[21 + pos] = val;
        }
    }

    // Encrypt each character
    for (i, &ch) in bytes.iter().enumerate() {
        let cp = cipher_pos(i);
        if i < NUM_TABLES && (ch as usize) < 128 {
            let enc = ENCRYPT[i][ch as usize];
            cipher[21 + cp] = if enc != 0xFF { enc } else {
                // fallback: space encoding
                ENCRYPT[i][b' ' as usize]
            };
        } else {
            cipher[21 + cp] = ch;
        }
    }

    Ok(url_safe_b64_encode(&cipher))
}

pub fn decrypt(ciphertext: &str) -> Result<String> {
    let cipher = url_safe_b64_decode(ciphertext)?;
    if cipher.len() <= 21 {
        bail!("cipher too short ({})", cipher.len());
    }

    let data_offset = 21usize;
    let data_len = cipher.len() - data_offset;

    // Calculate plaintext length from encrypted block length
    let pt_len = if data_len > 20 {
        7 + (data_len - 20)
    } else if data_len > 19 {
        7
    } else if data_len > 17 {
        6
    } else if data_len > 15 {
        5
    } else if data_len > 13 {
        4
    } else if data_len > 11 {
        3
    } else if data_len > 7 {
        2
    } else if data_len > 0 {
        1
    } else {
        0
    };

    let mut plaintext = Vec::with_capacity(pt_len);

    for i in 0..pt_len {
        let cp = cipher_pos(i);
        let actual = data_offset + cp;
        if actual >= cipher.len() {
            break;
        }
        let byte = cipher[actual];
        let rev = build_decrypt_table(i);
        let ch = rev[byte as usize];
        if ch != 0xFF {
            plaintext.push(ch);
        } else {
            plaintext.push(byte);
        }
    }

    // Convert bytes to string using Latin-1 (each byte maps to its Unicode codepoint)
    // This matches JS behavior where String.fromCharCode works on raw bytes
    let result: String = plaintext.iter().map(|&b| b as char).collect();
    Ok(result)
}
