//! Lets a second Tern launch bring the already running (possibly tray-hidden)
//! window forward instead of exiting silently. A named auto-reset event in the
//! user's session namespace carries no data, so there is nothing to validate.
use windows_sys::Win32::{
    Foundation::{CloseHandle, HANDLE, WAIT_OBJECT_0},
    System::Threading::{CreateEventW, OpenEventW, SetEvent, WaitForSingleObject, EVENT_MODIFY_STATE, INFINITE},
    UI::WindowsAndMessaging::{AllowSetForegroundWindow, ASFW_ANY},
};

fn event_name(qa: bool) -> Vec<u16> {
    let name = if qa { "Local\io.github.guseoh.dark-todo-planner.qa.show" } else { "Local\io.github.guseoh.dark-todo-planner.show" };
    name.encode_utf16().chain(Some(0)).collect()
}

/// Owned by the first instance; signalled once per later launch.
pub struct ShowSignal(HANDLE);
// The handle is a kernel object reference usable from any thread.
unsafe impl Send for ShowSignal {}

impl ShowSignal {
    pub fn create(qa: bool) -> Option<Self> {
        let name = event_name(qa);
        let handle = unsafe { CreateEventW(std::ptr::null(), 0, 0, name.as_ptr()) };
        if handle.is_null() { None } else { Some(Self(handle)) }
    }

    /// Blocks until another launch asks for the window. Returns false on failure.
    pub fn wait(&self) -> bool {
        unsafe { WaitForSingleObject(self.0, INFINITE) == WAIT_OBJECT_0 }
    }
}

impl Drop for ShowSignal {
    fn drop(&mut self) { unsafe { CloseHandle(self.0); } }
}

/// Called by a launch that lost the instance lock. Returns whether the running
/// instance was reached.
pub fn notify_running_instance(qa: bool) -> bool {
    let name = event_name(qa);
    let handle = unsafe { OpenEventW(EVENT_MODIFY_STATE, 0, name.as_ptr()) };
    if handle.is_null() { return false; }
    unsafe {
        // The running instance may take foreground focus on our behalf.
        AllowSetForegroundWindow(ASFW_ANY);
        let signalled = SetEvent(handle) != 0;
        CloseHandle(handle);
        signalled
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn signal_reaches_waiting_instance() {
        // QA namespace keeps the test away from a real running Tern.
        let signal = ShowSignal::create(true).expect("event");
        assert!(notify_running_instance(true));
        assert!(signal.wait());
    }
}
