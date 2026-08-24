// Runs once when the server starts (both `next dev` and `next start`).
// On some networks, outbound HTTPS requests that carry an Authorization
// header get reset when Node resolves the destination to an IPv6 address
// (observed against Strava's API). Forcing IPv4 first avoids that path
// entirely; IPv4 is universally reachable, so this is a safe default.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const dns = await import("dns");
    dns.setDefaultResultOrder("ipv4first");
  }
}
