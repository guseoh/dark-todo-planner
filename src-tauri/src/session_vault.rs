//! Windows credential vault for the single Tern session cookie.
//! No plaintext file or fallback credential storage.
use std::{io, ptr};
use windows_sys::Win32::{
    Foundation::ERROR_NOT_FOUND,
    Security::Credentials::{CREDENTIALW, CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC, CredReadW, CredWriteW, CredDeleteW, CredFree},
};
const TARGET: &str = "io.github.guseoh.dark-todo-planner/session-v2";
fn target() -> Vec<u16> { TARGET.encode_utf16().chain(Some(0)).collect() }

pub fn read() -> io::Result<Option<String>> {
    let name = target();
    let mut raw: *mut CREDENTIALW = ptr::null_mut();
    if unsafe { CredReadW(name.as_ptr(), CRED_TYPE_GENERIC, 0, &mut raw) } == 0 {
        let error = io::Error::last_os_error();
        return if error.raw_os_error() == Some(ERROR_NOT_FOUND as i32) { Ok(None) } else { Err(error) };
    }
    if raw.is_null() { return Err(io::Error::other("credential missing")); }
    let result = unsafe {
        let credential = &*raw;
        if credential.CredentialBlobSize == 0 || credential.CredentialBlob.is_null() {
            Ok(None)
        } else {
            let bytes = std::slice::from_raw_parts(credential.CredentialBlob, credential.CredentialBlobSize as usize);
            String::from_utf8(bytes.to_vec()).map(Some).map_err(|_| io::Error::other("invalid stored credential"))
        }
    };
    unsafe { CredFree(raw.cast()); }
    result
}

pub fn write(token: &str) -> io::Result<()> {
    let mut name = target();
    let mut bytes = token.as_bytes().to_vec();
    let mut credential: CREDENTIALW = unsafe { std::mem::zeroed() };
    credential.Type = CRED_TYPE_GENERIC;
    credential.TargetName = name.as_mut_ptr();
    credential.CredentialBlobSize = bytes.len() as u32;
    credential.CredentialBlob = bytes.as_mut_ptr();
    // Local-machine persistence is scoped to the current Windows user.
    credential.Persist = CRED_PERSIST_LOCAL_MACHINE;
    if unsafe { CredWriteW(&credential, 0) } == 0 { Err(io::Error::last_os_error()) } else { Ok(()) }
}

pub fn clear() -> io::Result<()> {
    let name = target();
    if unsafe { CredDeleteW(name.as_ptr(), CRED_TYPE_GENERIC, 0) } != 0 { return Ok(()); }
    let error = io::Error::last_os_error();
    if error.raw_os_error() == Some(ERROR_NOT_FOUND as i32) { Ok(()) } else { Err(error) }
}
