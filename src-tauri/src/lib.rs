// Tauri commands that talk to cmd/agentserver's HTTP API
// (agent-lab/docs/agentserver.md). Each command takes base_url and token
// itself rather than storing them server-side — there is no server-side
// state in this process yet, just thin HTTP forwarding; the frontend
// holds connection state (see src/main.ts) and passes it on every call.
//
// Responses are returned to the frontend as raw serde_json::Value rather
// than typed structs: this avoids keeping two copies of agentserver's
// wire schema (Rust here, TypeScript in main.ts) in sync by hand for a
// first version. Worth a typed struct if/when this grows past "parse a
// few fields in TS".
use serde_json::Value;

async fn request(
    client: &reqwest::Client,
    method: reqwest::Method,
    base_url: &str,
    path: &str,
    token: &str,
    body: Option<Value>,
) -> Result<Value, String> {
    let url = format!("{}{}", base_url.trim_end_matches('/'), path);
    let mut req = client.request(method, url).bearer_auth(token);
    if let Some(b) = body {
        req = req.json(&b);
    }
    let resp = req.send().await.map_err(|e| format!("request failed: {e}"))?;
    let status = resp.status();
    let body: Value = resp
        .json()
        .await
        .map_err(|e| format!("invalid JSON response: {e}"))?;
    if !status.is_success() {
        let message = body
            .get("error")
            .and_then(Value::as_str)
            .unwrap_or("request failed");
        return Err(format!("{} ({})", message, status.as_u16()));
    }
    Ok(body)
}

#[tauri::command]
async fn create_session(base_url: String, token: String, name: String) -> Result<Value, String> {
    let client = reqwest::Client::new();
    request(
        &client,
        reqwest::Method::POST,
        &base_url,
        "/v1/sessions",
        &token,
        Some(serde_json::json!({ "name": name })),
    )
    .await
}

#[tauri::command]
async fn list_sessions(base_url: String, token: String) -> Result<Value, String> {
    let client = reqwest::Client::new();
    request(
        &client,
        reqwest::Method::GET,
        &base_url,
        "/v1/sessions",
        &token,
        None,
    )
    .await
}

#[tauri::command]
async fn get_messages(base_url: String, token: String, session_id: i64) -> Result<Value, String> {
    let client = reqwest::Client::new();
    request(
        &client,
        reqwest::Method::GET,
        &base_url,
        &format!("/v1/sessions/{session_id}/messages"),
        &token,
        None,
    )
    .await
}

#[tauri::command]
async fn send_message(
    base_url: String,
    token: String,
    session_id: i64,
    message: String,
) -> Result<Value, String> {
    let client = reqwest::Client::new();
    request(
        &client,
        reqwest::Method::POST,
        &base_url,
        &format!("/v1/sessions/{session_id}/messages"),
        &token,
        Some(serde_json::json!({ "message": message })),
    )
    .await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            create_session,
            list_sessions,
            get_messages,
            send_message
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
