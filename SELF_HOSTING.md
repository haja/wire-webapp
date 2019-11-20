# Self Hosting

for self-hosting, use .env.locahost as .env file

# CSP troubles

note, that for content security policy (CSP) to work, your backend must be reachable by a DNS record (e.g. by adding to /etc/hosts). otherwise, CSP will the request to <backendUrl>/self

# Browser to use

I only got this working in Chromium, not in Firefox
