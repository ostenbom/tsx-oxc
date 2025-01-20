import net from "net";

/**
 * Fetch transpiled content from a Rust-based TCP socket server.
 *
 * @param {string} host - The host address of the TCP server (e.g., "127.0.0.1").
 * @param {number} port - The port number of the TCP server.
 * @param {string} filePath - The path of the file to be transpiled.
 * @returns {Promise<string>} - The transpiled file content.
 */
export const getTranspiledOverTCP = async (
	host: string,
	port: number,
	filePath: string,
): Promise<string> => {
	return new Promise((resolve, reject) => {
		const client = net.createConnection({ host, port }, () => {
			console.log(`Connected to transpile server at ${host}:${port}`);
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
							resolve(
								Buffer.from(response.transpiled_code, "base64").toString(
									"utf-8",
								),
							);
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
			console.log("Disconnected from transpile server");
		});
	});
};
