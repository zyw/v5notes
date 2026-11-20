/** Names derived from the plugin id. */

/** hello-world -> HelloWorld */
export function toPascalCase(id) {
  return String(id)
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/** hello-world -> Hello World; used only when no --name was given. */
export function toDisplayName(id) {
  return String(id)
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
