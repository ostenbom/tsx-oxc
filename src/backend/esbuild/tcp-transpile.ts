import net from "net";
import type { Transformed } from "../../utils/transform/apply-transformers";

const host = "127.0.0.1"; // Replace with your TCP server host
const port = process.env.TS_EVAL_PORT; // Replace with your TCP server port

/**
 * Fetch transpiled content from a Rust-based TCP socket server.
 *
 * @param {string} host - The host address of the TCP server (e.g., "127.0.0.1").
 * @param {number} port - The port number of the TCP server.
 * @param {string} filePath - The path of the file to be transpiled.
 * @returns {Promise<string>} - The transpiled file content.
 */
export const getTranspiledOverTCP = async (
	filePath: string,
): Promise<Transformed> => {
	return new Promise((resolve, reject) => {
		const client = net.createConnection({ host, port }, () => {
			const request = JSON.stringify({ file_path: filePath }) + "\n";
			client.write(request);
		});

		let buffer = "";

		client.on("data", (data) => {
			buffer += data.toString();

			// Check for complete JSON responses (assuming one per line)
			const lines = buffer.split("\n");
			if (lines.length > 1) {
				const responseLine = lines.shift();
				buffer = lines.join("\n");
				if (responseLine && responseLine.trim() !== "") {
					try {
						const response = JSON.parse(responseLine);
						if (response.transpiled_code) {
							client.end();
							let map = null;
							if (response.source_map) {
								map = JSON.parse(response.source_map);
							}
							resolve({
								code: Buffer.from(response.transpiled_code, "base64").toString(
									"utf-8",
								),
								map,
							});
						} else {
							reject(
								new Error("Invalid response format: Missing transpiled_code"),
							);
						}
					} catch (err) {
						reject(new Error(`Failed to parse JSON response: ${err.message}`));
					}
				}
			}
		});

		client.on("error", (err) => {
			reject(new Error(`TCP Client Error: ${err.message}`));
		});

		client.on("end", () => {
			// console.log("Disconnected from transpile server");
		});
	});
};
