import { pathToFileURL } from "node:url";
import { sha1 } from "../../utils/sha1.js";
import cache from "../../utils/transform/cache.js";
import {
	applyTransformersSync,
	applyTransformers,
	type Transformed,
} from "../../utils/transform/apply-transformers.js";
import { getTranspiledOverTCP } from "./tcp-transpile.js";

const formatTcpTranspileError = (error: Error) => {
	const transformedError = new Error("TCP Transpile Error");
	transformedError.message = error.message;
	throw transformedError;
};

// Configuration for TCP transpile server
const tcpHost = "127.0.0.1"; // Replace with your TCP server host
const tcpPort = 3000; // Replace with your TCP server port

// Used by CJS loader
export const createEsbuildTransformSync =
	() =>
	(code: string, filePath: string): Transformed => {
		const [filePathWithoutQuery, query] = filePath.split("?");
		const define: { [key: string]: string } = {};

		if (
			!(
				filePathWithoutQuery.endsWith(".cjs") ||
				filePathWithoutQuery.endsWith(".cts")
			)
		) {
			define["import.meta.url"] = JSON.stringify(
				pathToFileURL(filePathWithoutQuery) + (query ? `?${query}` : ""),
			);
		}

		const hash = sha1(
			[code, filePathWithoutQuery, JSON.stringify(define)].join("-"),
		);
		let transformed = cache.get(hash);

		if (!transformed) {
			transformed = applyTransformersSync(filePath, code, [
				(_filePath, _code) => {
					let transpiledCode;
					try {
						transpiledCode = getTranspiledOverTCP(tcpHost, tcpPort, _filePath);
					} catch (error) {
						throw formatTcpTranspileError(error);
					}
					return { code: transpiledCode, map: null };
				},
			]);

			cache.set(hash, transformed);
		}

		return transformed;
	};

// Used by ESM loader
export const createEsbuildTransform =
	() =>
	async (code: string, filePath: string): Promise<Transformed> => {
		const hash = sha1([code, filePath].join("-"));
		let transformed = cache.get(hash);

		if (!transformed) {
			transformed = await applyTransformers(filePath, code, [
				async (_filePath, _code) => {
					let transpiledCode;
					try {
						transpiledCode = await getTranspiledOverTCP(
							tcpHost,
							tcpPort,
							_filePath,
						);
					} catch (error) {
						throw formatTcpTranspileError(error);
					}
					return { code: transpiledCode, map: null };
				},
			]);

			cache.set(hash, transformed);
		}

		return transformed;
	};
