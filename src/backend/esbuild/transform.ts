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
					let result;
					try {
						result = getTranspiledOverTCP(_filePath);
					} catch (error) {
						throw formatTcpTranspileError(error);
					}
					return result;
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
		let result;
		try {
			result = await getTranspiledOverTCP(filePath);
		} catch (error) {
			throw formatTcpTranspileError(error);
		}
		return result;
		const hash = sha1([code, filePath].join("-"));
		let transformed = cache.get(hash);

		if (!transformed) {
			transformed = await applyTransformers(filePath, code, [
				async (_filePath, _code) => {},
			]);

			cache.set(hash, transformed);
		}
		console.log("transformed return", transformed);

		return transformed;
	};
