// The Windows app runs in the notification area without a console window.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tokenmaxxing_lib::run()
}
