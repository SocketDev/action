import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import * as os from "os";
import { EOL } from "os";
import { constants, promises } from "fs";

//#region \0rolldown/runtime.js
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
var __require = /* #__PURE__ */ (() => createRequire(import.meta.url))();

//#endregion
//#region node_modules/.pnpm/@actions+core@3.0.1/node_modules/@actions/core/lib/utils.js
/**
* Sanitizes an input into a string so it can be passed into issueCommand safely
* @param input input to sanitize into a string
*/
function toCommandValue(input) {
	if (input === null || input === void 0) return "";
	else if (typeof input === "string" || input instanceof String) return input;
	return JSON.stringify(input);
}
/**
*
* @param annotationProperties
* @returns The command properties to send with the actual annotation command
* See IssueCommandProperties: https://github.com/actions/runner/blob/main/src/Runner.Worker/ActionCommandManager.cs#L646
*/
function toCommandProperties(annotationProperties) {
	if (!Object.keys(annotationProperties).length) return {};
	return {
		title: annotationProperties.title,
		file: annotationProperties.file,
		line: annotationProperties.startLine,
		endLine: annotationProperties.endLine,
		col: annotationProperties.startColumn,
		endColumn: annotationProperties.endColumn
	};
}

//#endregion
//#region node_modules/.pnpm/@actions+core@3.0.1/node_modules/@actions/core/lib/command.js
/**
* Issues a command to the GitHub Actions runner
*
* @param command - The command name to issue
* @param properties - Additional properties for the command (key-value pairs)
* @param message - The message to include with the command
* @remarks
* This function outputs a specially formatted string to stdout that the Actions
* runner interprets as a command. These commands can control workflow behavior,
* set outputs, create annotations, mask values, and more.
*
* Command Format:
*   ::name key=value,key=value::message
*
* @example
* ```typescript
* // Issue a warning annotation
* issueCommand('warning', {}, 'This is a warning message');
* // Output: ::warning::This is a warning message
*
* // Set an environment variable
* issueCommand('set-env', { name: 'MY_VAR' }, 'some value');
* // Output: ::set-env name=MY_VAR::some value
*
* // Add a secret mask
* issueCommand('add-mask', {}, 'secretValue123');
* // Output: ::add-mask::secretValue123
* ```
*
* @internal
* This is an internal utility function that powers the public API functions
* such as setSecret, warning, error, and exportVariable.
*/
function issueCommand(command, properties, message) {
	const cmd = new Command(command, properties, message);
	process.stdout.write(cmd.toString() + os.EOL);
}
const CMD_STRING = "::";
var Command = class {
	constructor(command, properties, message) {
		if (!command) command = "missing.command";
		this.command = command;
		this.properties = properties;
		this.message = message;
	}
	toString() {
		let cmdStr = CMD_STRING + this.command;
		if (this.properties && Object.keys(this.properties).length > 0) {
			cmdStr += " ";
			let first = true;
			for (const key in this.properties) if (this.properties.hasOwnProperty(key)) {
				const val = this.properties[key];
				if (val) {
					if (first) first = false;
					else cmdStr += ",";
					cmdStr += `${key}=${escapeProperty(val)}`;
				}
			}
		}
		cmdStr += `${CMD_STRING}${escapeData(this.message)}`;
		return cmdStr;
	}
};
function escapeData(s) {
	return toCommandValue(s).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}
function escapeProperty(s) {
	return toCommandValue(s).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A").replace(/:/g, "%3A").replace(/,/g, "%2C");
}

//#endregion
//#region node_modules/.pnpm/@actions+core@3.0.1/node_modules/@actions/core/lib/summary.js
var __awaiter$1 = void 0 && (void 0).__awaiter || function(thisArg, _arguments, P, generator) {
	function adopt(value) {
		return value instanceof P ? value : new P(function(resolve) {
			resolve(value);
		});
	}
	return new (P || (P = Promise))(function(resolve, reject) {
		function fulfilled(value) {
			try {
				step(generator.next(value));
			} catch (e) {
				reject(e);
			}
		}
		function rejected(value) {
			try {
				step(generator["throw"](value));
			} catch (e) {
				reject(e);
			}
		}
		function step(result) {
			result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
		}
		step((generator = generator.apply(thisArg, _arguments || [])).next());
	});
};
const { access, appendFile, writeFile } = promises;
const SUMMARY_ENV_VAR = "GITHUB_STEP_SUMMARY";
var Summary = class {
	constructor() {
		this._buffer = "";
	}
	/**
	* Finds the summary file path from the environment, rejects if env var is not found or file does not exist
	* Also checks r/w permissions.
	*
	* @returns step summary file path
	*/
	filePath() {
		return __awaiter$1(this, void 0, void 0, function* () {
			if (this._filePath) return this._filePath;
			const pathFromEnv = process.env[SUMMARY_ENV_VAR];
			if (!pathFromEnv) throw new Error(`Unable to find environment variable for $${SUMMARY_ENV_VAR}. Check if your runtime environment supports job summaries.`);
			try {
				yield access(pathFromEnv, constants.R_OK | constants.W_OK);
			} catch (_a) {
				throw new Error(`Unable to access summary file: '${pathFromEnv}'. Check if the file has correct read/write permissions.`);
			}
			this._filePath = pathFromEnv;
			return this._filePath;
		});
	}
	/**
	* Wraps content in an HTML tag, adding any HTML attributes
	*
	* @param {string} tag HTML tag to wrap
	* @param {string | null} content content within the tag
	* @param {[attribute: string]: string} attrs key-value list of HTML attributes to add
	*
	* @returns {string} content wrapped in HTML element
	*/
	wrap(tag, content, attrs = {}) {
		const htmlAttrs = Object.entries(attrs).map(([key, value]) => ` ${key}="${value}"`).join("");
		if (!content) return `<${tag}${htmlAttrs}>`;
		return `<${tag}${htmlAttrs}>${content}</${tag}>`;
	}
	/**
	* Writes text in the buffer to the summary buffer file and empties buffer. Will append by default.
	*
	* @param {SummaryWriteOptions} [options] (optional) options for write operation
	*
	* @returns {Promise<Summary>} summary instance
	*/
	write(options) {
		return __awaiter$1(this, void 0, void 0, function* () {
			const overwrite = !!(options === null || options === void 0 ? void 0 : options.overwrite);
			const filePath = yield this.filePath();
			yield (overwrite ? writeFile : appendFile)(filePath, this._buffer, { encoding: "utf8" });
			return this.emptyBuffer();
		});
	}
	/**
	* Clears the summary buffer and wipes the summary file
	*
	* @returns {Summary} summary instance
	*/
	clear() {
		return __awaiter$1(this, void 0, void 0, function* () {
			return this.emptyBuffer().write({ overwrite: true });
		});
	}
	/**
	* Returns the current summary buffer as a string
	*
	* @returns {string} string of summary buffer
	*/
	stringify() {
		return this._buffer;
	}
	/**
	* If the summary buffer is empty
	*
	* @returns {boolen} true if the buffer is empty
	*/
	isEmptyBuffer() {
		return this._buffer.length === 0;
	}
	/**
	* Resets the summary buffer without writing to summary file
	*
	* @returns {Summary} summary instance
	*/
	emptyBuffer() {
		this._buffer = "";
		return this;
	}
	/**
	* Adds raw text to the summary buffer
	*
	* @param {string} text content to add
	* @param {boolean} [addEOL=false] (optional) append an EOL to the raw text (default: false)
	*
	* @returns {Summary} summary instance
	*/
	addRaw(text, addEOL = false) {
		this._buffer += text;
		return addEOL ? this.addEOL() : this;
	}
	/**
	* Adds the operating system-specific end-of-line marker to the buffer
	*
	* @returns {Summary} summary instance
	*/
	addEOL() {
		return this.addRaw(EOL);
	}
	/**
	* Adds an HTML codeblock to the summary buffer
	*
	* @param {string} code content to render within fenced code block
	* @param {string} lang (optional) language to syntax highlight code
	*
	* @returns {Summary} summary instance
	*/
	addCodeBlock(code, lang) {
		const attrs = Object.assign({}, lang && { lang });
		const element = this.wrap("pre", this.wrap("code", code), attrs);
		return this.addRaw(element).addEOL();
	}
	/**
	* Adds an HTML list to the summary buffer
	*
	* @param {string[]} items list of items to render
	* @param {boolean} [ordered=false] (optional) if the rendered list should be ordered or not (default: false)
	*
	* @returns {Summary} summary instance
	*/
	addList(items, ordered = false) {
		const tag = ordered ? "ol" : "ul";
		const listItems = items.map((item) => this.wrap("li", item)).join("");
		const element = this.wrap(tag, listItems);
		return this.addRaw(element).addEOL();
	}
	/**
	* Adds an HTML table to the summary buffer
	*
	* @param {SummaryTableCell[]} rows table rows
	*
	* @returns {Summary} summary instance
	*/
	addTable(rows) {
		const tableBody = rows.map((row) => {
			const cells = row.map((cell) => {
				if (typeof cell === "string") return this.wrap("td", cell);
				const { header, data, colspan, rowspan } = cell;
				const tag = header ? "th" : "td";
				const attrs = Object.assign(Object.assign({}, colspan && { colspan }), rowspan && { rowspan });
				return this.wrap(tag, data, attrs);
			}).join("");
			return this.wrap("tr", cells);
		}).join("");
		const element = this.wrap("table", tableBody);
		return this.addRaw(element).addEOL();
	}
	/**
	* Adds a collapsable HTML details element to the summary buffer
	*
	* @param {string} label text for the closed state
	* @param {string} content collapsable content
	*
	* @returns {Summary} summary instance
	*/
	addDetails(label, content) {
		const element = this.wrap("details", this.wrap("summary", label) + content);
		return this.addRaw(element).addEOL();
	}
	/**
	* Adds an HTML image tag to the summary buffer
	*
	* @param {string} src path to the image you to embed
	* @param {string} alt text description of the image
	* @param {SummaryImageOptions} options (optional) addition image attributes
	*
	* @returns {Summary} summary instance
	*/
	addImage(src, alt, options) {
		const { width, height } = options || {};
		const attrs = Object.assign(Object.assign({}, width && { width }), height && { height });
		const element = this.wrap("img", null, Object.assign({
			src,
			alt
		}, attrs));
		return this.addRaw(element).addEOL();
	}
	/**
	* Adds an HTML section heading element
	*
	* @param {string} text heading text
	* @param {number | string} [level=1] (optional) the heading level, default: 1
	*
	* @returns {Summary} summary instance
	*/
	addHeading(text, level) {
		const tag = `h${level}`;
		const allowedTag = [
			"h1",
			"h2",
			"h3",
			"h4",
			"h5",
			"h6"
		].includes(tag) ? tag : "h1";
		const element = this.wrap(allowedTag, text);
		return this.addRaw(element).addEOL();
	}
	/**
	* Adds an HTML thematic break (<hr>) to the summary buffer
	*
	* @returns {Summary} summary instance
	*/
	addSeparator() {
		const element = this.wrap("hr", null);
		return this.addRaw(element).addEOL();
	}
	/**
	* Adds an HTML line break (<br>) to the summary buffer
	*
	* @returns {Summary} summary instance
	*/
	addBreak() {
		const element = this.wrap("br", null);
		return this.addRaw(element).addEOL();
	}
	/**
	* Adds an HTML blockquote to the summary buffer
	*
	* @param {string} text quote text
	* @param {string} cite (optional) citation url
	*
	* @returns {Summary} summary instance
	*/
	addQuote(text, cite) {
		const attrs = Object.assign({}, cite && { cite });
		const element = this.wrap("blockquote", text, attrs);
		return this.addRaw(element).addEOL();
	}
	/**
	* Adds an HTML anchor tag to the summary buffer
	*
	* @param {string} text link text/content
	* @param {string} href hyperlink
	*
	* @returns {Summary} summary instance
	*/
	addLink(text, href) {
		const element = this.wrap("a", text, { href });
		return this.addRaw(element).addEOL();
	}
};
const _summary = new Summary();
const summary = _summary;

//#endregion
//#region node_modules/.pnpm/@actions+core@3.0.1/node_modules/@actions/core/lib/core.js
var __awaiter = void 0 && (void 0).__awaiter || function(thisArg, _arguments, P, generator) {
	function adopt(value) {
		return value instanceof P ? value : new P(function(resolve) {
			resolve(value);
		});
	}
	return new (P || (P = Promise))(function(resolve, reject) {
		function fulfilled(value) {
			try {
				step(generator.next(value));
			} catch (e) {
				reject(e);
			}
		}
		function rejected(value) {
			try {
				step(generator["throw"](value));
			} catch (e) {
				reject(e);
			}
		}
		function step(result) {
			result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
		}
		step((generator = generator.apply(thisArg, _arguments || [])).next());
	});
};
/**
* The code to exit an action
*/
var ExitCode;
(function(ExitCode) {
	/**
	* A code indicating that the action was successful
	*/
	ExitCode[ExitCode["Success"] = 0] = "Success";
	/**
	* A code indicating that the action was a failure
	*/
	ExitCode[ExitCode["Failure"] = 1] = "Failure";
})(ExitCode || (ExitCode = {}));
/**
* Gets the value of an input.
* Unless trimWhitespace is set to false in InputOptions, the value is also trimmed.
* Returns an empty string if the value is not defined.
*
* @param     name     name of the input to get
* @param     options  optional. See InputOptions.
* @returns   string
*/
function getInput(name, options) {
	const val = process.env[`INPUT_${name.replace(/ /g, "_").toUpperCase()}`] || "";
	if (options && options.required && !val) throw new Error(`Input required and not supplied: ${name}`);
	if (options && options.trimWhitespace === false) return val;
	return val.trim();
}
/**
* Sets the action status to failed.
* When the action exits it will be with an exit code of 1
* @param message add error issue message
*/
function setFailed(message) {
	process.exitCode = ExitCode.Failure;
	error(message);
}
/**
* Writes debug message to user log
* @param message debug message
*/
function debug(message) {
	issueCommand("debug", {}, message);
}
/**
* Adds an error issue
* @param message error issue message. Errors will be converted to string via toString()
* @param properties optional properties to add to the annotation.
*/
function error(message, properties = {}) {
	issueCommand("error", toCommandProperties(properties), message instanceof Error ? message.toString() : message);
}
/**
* Writes info to log with console.log.
* @param message info message
*/
function info(message) {
	process.stdout.write(message + os.EOL);
}

//#endregion
//#region node_modules/.pnpm/@socketregistry+packageurl-js@1.5.0/node_modules/@socketregistry/packageurl-js/dist/index.js
var require_dist = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
	var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
	let node_module = __require("node:module");
	var require_purl = /* @__PURE__ */ __commonJSMin(((exports$1) => {
		Object.defineProperty(exports$1, Symbol.toStringTag, { value: "Module" });
		exports$1.PURL_Type = {
			ALPM: "alpm",
			APK: "apk",
			BITBUCKET: "bitbucket",
			COCOAPODS: "cocoapods",
			CARGO: "cargo",
			CHROME: "chrome",
			COMPOSER: "composer",
			CONAN: "conan",
			CONDA: "conda",
			CRAN: "cran",
			DEB: "deb",
			DOCKER: "docker",
			GEM: "gem",
			GENERIC: "generic",
			GITHUB: "github",
			GOLANG: "golang",
			HACKAGE: "hackage",
			HEX: "hex",
			HUGGINGFACE: "huggingface",
			MAVEN: "maven",
			MLFLOW: "mlflow",
			NPM: "npm",
			NUGET: "nuget",
			OCI: "oci",
			PUB: "pub",
			PYPI: "pypi",
			QPKG: "qpkg",
			RPM: "rpm",
			SWID: "swid",
			SWIFT: "swift",
			VCS: "vcs",
			VSCODE: "vscode"
		};
	}));
	var require_error = /* @__PURE__ */ __commonJSMin(((exports$2) => {
		Object.defineProperty(exports$2, Symbol.toStringTag, { value: "Module" });
		/**
		* @file Safe references to `Error` and its subclass constructors, plus V8's
		*   stack-trace API. `Error.isError` is ES2025; `captureStackTrace` /
		*   `prepareStackTrace` / `stackTraceLimit` are V8 extensions absent on
		*   JavaScriptCore and SpiderMonkey. Each is typed `Function | undefined` so
		*   non-V8 importers stay safe.
		*/
		const ErrorCtor = Error;
		const AggregateErrorCtor = AggregateError;
		const EvalErrorCtor = EvalError;
		const RangeErrorCtor = RangeError;
		const ReferenceErrorCtor = ReferenceError;
		const SyntaxErrorCtor = SyntaxError;
		const TypeErrorCtor = TypeError;
		const URIErrorCtor = URIError;
		const ErrorIsError = Error.isError;
		const ErrorCaptureStackTrace = Error.captureStackTrace;
		const ErrorPrepareStackTrace = Error.prepareStackTrace;
		const stackTraceLimitGetter = (() => {
			const getter = Error.__lookupGetter__?.("stackTraceLimit");
			/* c8 ignore start */
			if (typeof getter === "function") return () => getter.call(Error);
			/* c8 ignore stop */
		})();
		function ErrorStackTraceLimit() {
			/* c8 ignore start - non-V8 fallback path unreachable under test */
			if (stackTraceLimitGetter) return stackTraceLimitGetter();
			return Error.stackTraceLimit;
			/* c8 ignore stop */
		}
		exports$2.AggregateErrorCtor = AggregateErrorCtor;
		exports$2.ErrorCaptureStackTrace = ErrorCaptureStackTrace;
		exports$2.ErrorCtor = ErrorCtor;
		exports$2.ErrorIsError = ErrorIsError;
		exports$2.ErrorPrepareStackTrace = ErrorPrepareStackTrace;
		exports$2.ErrorStackTraceLimit = ErrorStackTraceLimit;
		exports$2.EvalErrorCtor = EvalErrorCtor;
		exports$2.RangeErrorCtor = RangeErrorCtor;
		exports$2.ReferenceErrorCtor = ReferenceErrorCtor;
		exports$2.SyntaxErrorCtor = SyntaxErrorCtor;
		exports$2.TypeErrorCtor = TypeErrorCtor;
		exports$2.URIErrorCtor = URIErrorCtor;
	}));
	var require_runtime = /* @__PURE__ */ __commonJSMin(((exports$3) => {
		Object.defineProperty(exports$3, Symbol.toStringTag, { value: "Module" });
		/**
		* @file Runtime environment detection constants. All checks use only
		*   `typeof`-safe global probes so this module is safe to import in browser,
		*   Node.js, Deno, Bun, and bundled contexts alike.
		*/
		/**
		* True when running inside a Node.js process. Detected via
		* `process.versions.node` — present in Node, absent in browsers and Deno/Bun
		* which expose a different `process.versions` shape (or no `process` at all).
		*/
		const IS_NODE = typeof process !== "undefined" && typeof process.versions !== "undefined" && typeof process.versions.node === "string";
		/**
		* True when running in a browser context (window + document both defined).
		* Note: Chrome extensions have `window` in popup contexts but not in service
		* workers — check `IS_SERVICE_WORKER` for that case.
		*/
		const IS_BROWSER = typeof window !== "undefined" && typeof document !== "undefined";
		/**
		* True when running inside a Web Worker / Chrome MV3 service worker. `self` is
		* defined without `window` in worker contexts.
		*/
		const IS_WORKER = typeof self !== "undefined" && typeof window === "undefined" && typeof document === "undefined";
		exports$3.IS_BROWSER = IS_BROWSER;
		exports$3.IS_NODE = IS_NODE;
		exports$3.IS_WORKER = IS_WORKER;
	}));
	var require_module = /* @__PURE__ */ __commonJSMin(((exports$4) => {
		Object.defineProperty(exports$4, Symbol.toStringTag, { value: "Module" });
		const require_constants_runtime = require_runtime();
		let module$1 = __require("module");
		/**
		* @file Accessors for `node:module` that work across runtimes. Ambient
		*   `require` is bound in CommonJS but unbound in ESM and inside
		*   ahead-of-time-compiled package modules (e.g. Perry), where reading it
		*   throws. And Perry's `require('module')` value omits `isBuiltin`. So instead
		*   of the ambient `require('module')` lazy-loader, `isBuiltin`/`createRequire`
		*   are imported as named values from the bare `module` specifier — which
		*   resolves on Node and Perry, and which browser bundlers can stub via
		*   resolve.fallback (a `node:` prefix would throw UnhandledSchemeError
		*   there).
		*   `require` is DIRECTORY-SPECIFIC: `createRequire(base)` resolves relative
		*   specifiers (`./x`, `../y`) from `base`'s directory. For builtins and bare
		*   packages that's irrelevant since they resolve the same anywhere, so the
		*   cached `getRequire` / `requireBuiltin` bind to THIS file. A RELATIVE
		*   specifier must resolve from the CALLER's directory, so use `requireFrom`
		*   with the caller's `import.meta.url` — binding such a load to this file
		*   would resolve it against `src/node/` instead. Bundled, every module
		*   collapses to one base and either works; unbundled (e.g. AOT-compiled from
		*   source), each module sits at its own nested path and the base matters.
		*/
		let cachedModule;
		let cachedRequire;
		/**
		* Bind a working `require`. Ambient `require` exists in CommonJS; in ESM and
		* ahead-of-time-compiled package modules it is unbound (reading it throws or
		* yields undefined), so fall back to `createRequire`. Returns undefined off
		* Node and in browsers, where neither is available.
		*
		* `fromUrl` sets the resolution base — pass a caller's `import.meta.url` to
		* resolve that caller's RELATIVE specifiers. When omitted, the base is this
		* file, which is correct only for builtins / bare packages (dir-independent).
		* With `fromUrl` the ambient `require` is skipped: it is bound to THIS file, so
		* it would resolve a relative specifier from the wrong directory.
		*/
		function bindRequire(fromUrl) {
			if (!require_constants_runtime.IS_NODE) return;
			if (!fromUrl && typeof __require === "function") return __require;
			if (typeof module$1.createRequire === "function") try {
				return (0, module$1.createRequire)(fromUrl ?? __require("url").pathToFileURL(__filename).href);
			} catch {
				return;
			}
		}
		/**
		* Returns `node:module` loaded through the bound `require`, or undefined off
		* Node. Cached across calls.
		*/
		function getNodeModule() {
			return cachedModule ??= requireBuiltin("module");
		}
		/**
		* Returns a working `require` bound to THIS file, binding one on first call
		* (see bindRequire). Cached across calls; undefined off Node / in browsers.
		*
		* For builtins and bare packages only — the resolution base is this file, so a
		* relative specifier would resolve from `src/node/`. Use `requireFrom` for
		* relative loads.
		*/
		function getRequire() {
			if (cachedRequire === void 0) cachedRequire = bindRequire();
			return cachedRequire;
		}
		/**
		* Is `name` a Node built-in module? Resolved from the statically-imported
		* `isBuiltin`, so it works on Node and on ahead-of-time-compiled binaries
		* (Perry), where ambient `require('module')` would lack `isBuiltin`. Returns
		* false in browsers, where the bare `module` import is stubbed away.
		*
		* Single source of truth for "is this a Node builtin?" probes across socket-lib
		* (used by the smol-binding loaders to gate their `node:smol-*` loads).
		*/
		function isNodeBuiltin(name) {
			if (!require_constants_runtime.IS_NODE || typeof module$1.isBuiltin !== "function") return false;
			return (0, module$1.isBuiltin)(name);
		}
		/**
		* Load a built-in module by *computed* specifier through the bound `require`
		* (see getRequire). The specifier is a parameter — never a literal at the call
		* site — so browser bundlers neither walk nor bundle it. Returns undefined
		* where no `require` can be bound.
		*
		* Builtins / bare packages only (dir-independent); for a relative specifier use
		* `requireFrom`. Used by `getNodeModule` for `node:module`, and by the
		* smol-binding loaders for the optional `node:smol-*` native bindings (gated
		* behind `isNodeBuiltin`, true only on socket-btm's smol Node binary).
		*/
		function requireBuiltin(specifier) {
			const req = getRequire();
			if (req) return req(specifier);
		}
		/**
		* Load a module by specifier from a CALLER-supplied base (its
		* `import.meta.url`). Use this for RELATIVE specifiers (`./x`, `../y`), whose
		* resolution depends on the caller's directory — `requireBuiltin` binds to this
		* file and would resolve them from `src/node/`. Not cached: the binding is
		* per-caller. Returns undefined where no `require` can be bound.
		*/
		function requireFrom(fromUrl, specifier) {
			const req = bindRequire(fromUrl);
			if (req) return req(specifier);
		}
		exports$4.bindRequire = bindRequire;
		exports$4.getNodeModule = getNodeModule;
		exports$4.getRequire = getRequire;
		exports$4.isNodeBuiltin = isNodeBuiltin;
		exports$4.requireBuiltin = requireBuiltin;
		exports$4.requireFrom = requireFrom;
	}));
	var require_detect = /* @__PURE__ */ __commonJSMin(((exports$5) => {
		Object.defineProperty(exports$5, Symbol.toStringTag, { value: "Module" });
		const require_node_module = require_module();
		/**
		* @file Smol detection + lazy-loader for `node:smol-util`. Two
		*   responsibilities:
		*
		*   1. `isSmol()` — memoized boolean detector for socket-btm's smol Node binary.
		*      Mirrors `isSeaBinary()` from `src/sea.ts`. Probes via
		*      `node:module.isBuiltin('node:smol-util')` since only the smol binary
		*      registers any `node:smol-*` builtins.
		*   2. `getSmolUtil()` — lazy-loader for the `node:smol-util` binding, which
		*      provides native `uncurryThis` and `applyBind` (single V8 dispatch via
		*      `args.Data()` + `v8::Function::Call`, skipping the BoundFunction adapter
		*      + `Function.prototype.call` trampoline that the JS form
		*      `bind.bind(call)(fn)` hits twice per invocation). ~2x faster on hot
		*      uncurried-call sites. `getSmolUtil()` returns `undefined` on stock Node
		*      + non-Node runtimes. Result is cached across calls; the lazy-loader
		*      follows the same shape as `src/node/fs.ts` etc.
		*
		* @see https://github.com/SocketDev/socket-btm — socket-btm builds
		*   the smol binary that exposes the `node:smol-util` binding.
		*/
		/**
		* Cached smol-binary detection result.
		*/
		let isSmolCache;
		/**
		* Cached `node:smol-util` binding. `null` = probed and unavailable; `undefined`
		* = not yet probed. JS truthiness collapses both to "no binding" at the call
		* site.
		*/
		let smolUtilCache;
		let smolUtilProbed = false;
		/**
		* Returns `node:smol-util` when running on the smol Node binary, otherwise
		* `undefined`. Result is cached across calls.
		*/
		function getSmolUtil() {
			if (!smolUtilProbed) {
				smolUtilProbed = true;
				/* c8 ignore start - smol Node binary only. */
				if (require_node_module.isNodeBuiltin("node:smol-util")) smolUtilCache = require_node_module.requireBuiltin("node:smol-util");
			}
			return smolUtilCache;
		}
		/**
		* Detect if the current process is running on socket-btm's smol Node binary.
		* Memoized on first call.
		*
		* Defensive across runtimes: returns `false` on stock Node, browsers (no
		* `node:module`), Deno and Bun, whose module resolution differs, and worker
		* threads, each of which has its own builtin table.
		*
		* @example
		*   ;```ts
		*   import { isSmol } from '@socketsecurity/lib/smol/detect'
		*
		*   if (isSmol()) {
		*     // running on the smol binary; native fast paths available
		*   }
		*   ```
		*/
		function isSmol() {
			if (isSmolCache === void 0) isSmolCache = require_node_module.isNodeBuiltin("node:smol-util");
			return isSmolCache;
		}
		exports$5.getSmolUtil = getSmolUtil;
		exports$5.isSmol = isSmol;
	}));
	var require_uncurry = /* @__PURE__ */ __commonJSMin(((exports$6) => {
		Object.defineProperty(exports$6, Symbol.toStringTag, { value: "Module" });
		/**
		* @file `uncurryThis` and the cluster of helpers built atop it. Mirrors
		*   Node.js's internal/per_context/primordials.js. Every other primordials leaf
		*   depends on `uncurryThis` to expose prototype-method primordials, so this
		*   file must be import-safe before any of them. Smol fast paths
		*   (`node:smol-util`) replace the JS forms when running on socket-btm's smol
		*   Node binary; stock Node and other runtimes fall back to the standard
		*   `bind.bind(call)` shape. **IMPORTANT**: do not destructure on `globalThis`
		*   or `Reflect` here. tsgo has a bug that mis-transpiles destructured exports.
		*   See: https://github.com/SocketDev/socket-packageurl-js/issues/3.
		*/
		const smolUtil = require_detect().getSmolUtil();
		const { apply, bind, call } = Function.prototype;
		const uncurryThis = smolUtil?.uncurryThis ?? bind.bind(call);
		const applyBind = smolUtil?.applyBind ?? bind.bind(apply);
		const applyBoundForSafe = applyBind;
		const applySafe = smolUtil?.applySafe ?? ((fn) => {
			const apply2 = applyBoundForSafe(fn);
			return (self, args) => {
				try {
					return apply2(self, args);
				} catch {
					return;
				}
			};
		});
		const bindCallFallback = ((fn, thisArg, ...presetArgs) => Function.prototype.bind.apply(fn, [thisArg, ...presetArgs]));
		const bindCall = smolUtil?.bindCall ?? bindCallFallback;
		const weakRefSafe = smolUtil?.weakRefSafe ?? ((target) => {
			try {
				return new WeakRef(target);
			} catch {
				return;
			}
		});
		exports$6.applyBind = applyBind;
		exports$6.applySafe = applySafe;
		exports$6.bindCall = bindCall;
		exports$6.uncurryThis = uncurryThis;
		exports$6.weakRefSafe = weakRefSafe;
	}));
	var require_map_set = /* @__PURE__ */ __commonJSMin(((exports$7) => {
		Object.defineProperty(exports$7, Symbol.toStringTag, { value: "Module" });
		const require_primordials_uncurry = require_uncurry();
		const require_primordials_error = require_error();
		/**
		* @file Safe references to `Map`, `Set`, `WeakMap`, `WeakSet`, and `WeakRef`.
		*   Constructors plus uncurried prototype methods. `WeakRef` exposes only its
		*   constructor — there's a separate `weakRefSafe` wrapper in `./uncurry` for
		*   the throws-on-non-Object case.
		*/
		const MapCtor = Map;
		const SetCtor = Set;
		const WeakMapCtor = WeakMap;
		const WeakRefCtor = WeakRef;
		const WeakSetCtor = WeakSet;
		const MapPrototypeClear = require_primordials_uncurry.uncurryThis(Map.prototype.clear);
		const MapPrototypeDelete = require_primordials_uncurry.uncurryThis(Map.prototype.delete);
		const MapPrototypeEntries = require_primordials_uncurry.uncurryThis(Map.prototype.entries);
		const MapPrototypeForEach = require_primordials_uncurry.uncurryThis(Map.prototype.forEach);
		const MapPrototypeGet = require_primordials_uncurry.uncurryThis(Map.prototype.get);
		const MapPrototypeGetOrInsert = Map.prototype.getOrInsert === void 0 ? mapGetOrInsertFallback : require_primordials_uncurry.uncurryThis(Map.prototype.getOrInsert);
		const MapPrototypeGetOrInsertComputed = Map.prototype.getOrInsertComputed === void 0 ? mapGetOrInsertComputedFallback : require_primordials_uncurry.uncurryThis(Map.prototype.getOrInsertComputed);
		const MapPrototypeHas = require_primordials_uncurry.uncurryThis(Map.prototype.has);
		const MapPrototypeKeys = require_primordials_uncurry.uncurryThis(Map.prototype.keys);
		const MapPrototypeSet = require_primordials_uncurry.uncurryThis(Map.prototype.set);
		const MapPrototypeValues = require_primordials_uncurry.uncurryThis(Map.prototype.values);
		const SetPrototypeAdd = require_primordials_uncurry.uncurryThis(Set.prototype.add);
		const SetPrototypeClear = require_primordials_uncurry.uncurryThis(Set.prototype.clear);
		const SetPrototypeDelete = require_primordials_uncurry.uncurryThis(Set.prototype.delete);
		const SetPrototypeDifference = require_primordials_uncurry.uncurryThis(Set.prototype.difference);
		const SetPrototypeEntries = require_primordials_uncurry.uncurryThis(Set.prototype.entries);
		const SetPrototypeForEach = require_primordials_uncurry.uncurryThis(Set.prototype.forEach);
		const SetPrototypeHas = require_primordials_uncurry.uncurryThis(Set.prototype.has);
		const SetPrototypeIntersection = require_primordials_uncurry.uncurryThis(Set.prototype.intersection);
		const SetPrototypeIsDisjointFrom = require_primordials_uncurry.uncurryThis(Set.prototype.isDisjointFrom);
		const SetPrototypeIsSubsetOf = require_primordials_uncurry.uncurryThis(Set.prototype.isSubsetOf);
		const SetPrototypeIsSupersetOf = require_primordials_uncurry.uncurryThis(Set.prototype.isSupersetOf);
		const SetPrototypeKeys = require_primordials_uncurry.uncurryThis(Set.prototype.keys);
		const SetPrototypeSymmetricDifference = require_primordials_uncurry.uncurryThis(Set.prototype.symmetricDifference);
		const SetPrototypeUnion = require_primordials_uncurry.uncurryThis(Set.prototype.union);
		const SetPrototypeValues = require_primordials_uncurry.uncurryThis(Set.prototype.values);
		const WeakMapPrototypeDelete = require_primordials_uncurry.uncurryThis(WeakMap.prototype.delete);
		const WeakMapPrototypeGet = require_primordials_uncurry.uncurryThis(WeakMap.prototype.get);
		const WeakMapPrototypeGetOrInsert = WeakMap.prototype.getOrInsert === void 0 ? weakMapGetOrInsertFallback : require_primordials_uncurry.uncurryThis(WeakMap.prototype.getOrInsert);
		const WeakMapPrototypeGetOrInsertComputed = WeakMap.prototype.getOrInsertComputed === void 0 ? weakMapGetOrInsertComputedFallback : require_primordials_uncurry.uncurryThis(WeakMap.prototype.getOrInsertComputed);
		const WeakMapPrototypeHas = require_primordials_uncurry.uncurryThis(WeakMap.prototype.has);
		const WeakMapPrototypeSet = require_primordials_uncurry.uncurryThis(WeakMap.prototype.set);
		const WeakSetPrototypeAdd = require_primordials_uncurry.uncurryThis(WeakSet.prototype.add);
		const WeakSetPrototypeDelete = require_primordials_uncurry.uncurryThis(WeakSet.prototype.delete);
		const WeakSetPrototypeHas = require_primordials_uncurry.uncurryThis(WeakSet.prototype.has);
		function mapGetOrInsertComputedFallback(map, key, callbackfn) {
			if (typeof callbackfn !== "function") throw new require_primordials_error.TypeErrorCtor(`getOrInsertComputed takes a callback. Saw ${typeof callbackfn}, wanted a function computing the value to insert.`);
			if (MapPrototypeHas(map, key)) return MapPrototypeGet(map, key);
			const value = callbackfn(key);
			MapPrototypeSet(map, key, value);
			return value;
		}
		function mapGetOrInsertFallback(map, key, value) {
			if (MapPrototypeHas(map, key)) return MapPrototypeGet(map, key);
			MapPrototypeSet(map, key, value);
			return value;
		}
		function weakMapGetOrInsertComputedFallback(map, key, callbackfn) {
			if (typeof callbackfn !== "function") throw new require_primordials_error.TypeErrorCtor(`getOrInsertComputed takes a callback. Saw ${typeof callbackfn}, wanted a function computing the value to insert.`);
			if (WeakMapPrototypeHas(map, key)) return WeakMapPrototypeGet(map, key);
			const value = callbackfn(key);
			WeakMapPrototypeSet(map, key, value);
			return value;
		}
		function weakMapGetOrInsertFallback(map, key, value) {
			if (WeakMapPrototypeHas(map, key)) return WeakMapPrototypeGet(map, key);
			WeakMapPrototypeSet(map, key, value);
			return value;
		}
		exports$7.MapCtor = MapCtor;
		exports$7.MapPrototypeClear = MapPrototypeClear;
		exports$7.MapPrototypeDelete = MapPrototypeDelete;
		exports$7.MapPrototypeEntries = MapPrototypeEntries;
		exports$7.MapPrototypeForEach = MapPrototypeForEach;
		exports$7.MapPrototypeGet = MapPrototypeGet;
		exports$7.MapPrototypeGetOrInsert = MapPrototypeGetOrInsert;
		exports$7.MapPrototypeGetOrInsertComputed = MapPrototypeGetOrInsertComputed;
		exports$7.MapPrototypeHas = MapPrototypeHas;
		exports$7.MapPrototypeKeys = MapPrototypeKeys;
		exports$7.MapPrototypeSet = MapPrototypeSet;
		exports$7.MapPrototypeValues = MapPrototypeValues;
		exports$7.SetCtor = SetCtor;
		exports$7.SetPrototypeAdd = SetPrototypeAdd;
		exports$7.SetPrototypeClear = SetPrototypeClear;
		exports$7.SetPrototypeDelete = SetPrototypeDelete;
		exports$7.SetPrototypeDifference = SetPrototypeDifference;
		exports$7.SetPrototypeEntries = SetPrototypeEntries;
		exports$7.SetPrototypeForEach = SetPrototypeForEach;
		exports$7.SetPrototypeHas = SetPrototypeHas;
		exports$7.SetPrototypeIntersection = SetPrototypeIntersection;
		exports$7.SetPrototypeIsDisjointFrom = SetPrototypeIsDisjointFrom;
		exports$7.SetPrototypeIsSubsetOf = SetPrototypeIsSubsetOf;
		exports$7.SetPrototypeIsSupersetOf = SetPrototypeIsSupersetOf;
		exports$7.SetPrototypeKeys = SetPrototypeKeys;
		exports$7.SetPrototypeSymmetricDifference = SetPrototypeSymmetricDifference;
		exports$7.SetPrototypeUnion = SetPrototypeUnion;
		exports$7.SetPrototypeValues = SetPrototypeValues;
		exports$7.WeakMapCtor = WeakMapCtor;
		exports$7.WeakMapPrototypeDelete = WeakMapPrototypeDelete;
		exports$7.WeakMapPrototypeGet = WeakMapPrototypeGet;
		exports$7.WeakMapPrototypeGetOrInsert = WeakMapPrototypeGetOrInsert;
		exports$7.WeakMapPrototypeGetOrInsertComputed = WeakMapPrototypeGetOrInsertComputed;
		exports$7.WeakMapPrototypeHas = WeakMapPrototypeHas;
		exports$7.WeakMapPrototypeSet = WeakMapPrototypeSet;
		exports$7.WeakRefCtor = WeakRefCtor;
		exports$7.WeakSetCtor = WeakSetCtor;
		exports$7.WeakSetPrototypeAdd = WeakSetPrototypeAdd;
		exports$7.WeakSetPrototypeDelete = WeakSetPrototypeDelete;
		exports$7.WeakSetPrototypeHas = WeakSetPrototypeHas;
		exports$7.mapGetOrInsertComputedFallback = mapGetOrInsertComputedFallback;
		exports$7.mapGetOrInsertFallback = mapGetOrInsertFallback;
		exports$7.weakMapGetOrInsertComputedFallback = weakMapGetOrInsertComputedFallback;
		exports$7.weakMapGetOrInsertFallback = weakMapGetOrInsertFallback;
	}));
	var require_regexp = /* @__PURE__ */ __commonJSMin(((exports$8) => {
		Object.defineProperty(exports$8, Symbol.toStringTag, { value: "Module" });
		const require_primordials_uncurry = require_uncurry();
		/**
		* @file Safe references to `RegExp` and its prototype methods. `RegExp.escape`
		*   is ES2025; the primordial is typed `Function | undefined` so older runtimes
		*   still load. The Symbol-keyed `[Symbol.match]` / `[Symbol.replace]` slots
		*   are exposed alongside the named methods because some callers use them via
		*   dynamic dispatch (e.g. `String.prototype.match` invokes
		*   `RegExp.prototype[Symbol.match]` internally).
		*/
		const RegExpCtor = RegExp;
		const RegExpEscape = RegExp.escape;
		const RegExpPrototypeExec = require_primordials_uncurry.uncurryThis(RegExp.prototype.exec);
		const RegExpPrototypeTest = require_primordials_uncurry.uncurryThis(RegExp.prototype.test);
		const RegExpPrototypeSymbolMatch = require_primordials_uncurry.uncurryThis(RegExp.prototype[Symbol.match]);
		const RegExpPrototypeSymbolReplace = require_primordials_uncurry.uncurryThis(RegExp.prototype[Symbol.replace]);
		exports$8.RegExpCtor = RegExpCtor;
		exports$8.RegExpEscape = RegExpEscape;
		exports$8.RegExpPrototypeExec = RegExpPrototypeExec;
		exports$8.RegExpPrototypeSymbolMatch = RegExpPrototypeSymbolMatch;
		exports$8.RegExpPrototypeSymbolReplace = RegExpPrototypeSymbolReplace;
		exports$8.RegExpPrototypeTest = RegExpPrototypeTest;
	}));
	var require_primordial = /* @__PURE__ */ __commonJSMin(((exports$9) => {
		Object.defineProperty(exports$9, Symbol.toStringTag, { value: "Module" });
		const require_node_module = require_module();
		/**
		* @file Lazy-loader for socket-btm's `node:smol-primordial` binding.
		*   `node:smol-primordial` provides V8 Fast API typed implementations of Math.*
		*   and Number.is* primordials, registered with `CFunction::Make()` so TurboFan
		*   inlines them directly into JIT- compiled JS callers. Bypasses the
		*   FunctionCallbackInfo trampoline entirely — ~30-50% gain on hot loops where
		*   V8 doesn't already auto-inline. Returns `undefined` on stock Node +
		*   non-Node runtimes. Result is cached across calls.
		*
		* @internal — used by `src/primordials.ts` to resolve smol-aware
		*   Math.* / Number.is* fast paths. Most callers should use the
		*   standard `primordials` exports, which already route through this
		*   when smol is present.
		*
		* @see https://v8.dev/blog/v8-release-99 — V8 Fast API Calls overview
		*/
		let smolPrimordial;
		let smolPrimordialProbed = false;
		/**
		* Returns `node:smol-primordial` when running on the smol Node binary,
		* otherwise `undefined`. Result is cached across calls.
		*/
		function getSmolPrimordial() {
			if (!smolPrimordialProbed) {
				smolPrimordialProbed = true;
				/* c8 ignore start - smol Node binary only. */
				if (require_node_module.isNodeBuiltin("node:smol-primordial")) smolPrimordial = require_node_module.requireBuiltin("node:smol-primordial");
			}
			return smolPrimordial;
		}
		exports$9.getSmolPrimordial = getSmolPrimordial;
	}));
	var require_string = /* @__PURE__ */ __commonJSMin(((exports$10) => {
		Object.defineProperty(exports$10, Symbol.toStringTag, { value: "Module" });
		const require_primordials_uncurry = require_uncurry();
		/**
		* @file Safe references to `String` static methods and prototype methods.
		*   `StringPrototypeCharCodeAt` prefers the smol Fast API binding for ASCII
		*   inputs, which reduces to a single byte load, and translates the `-1` Fast
		*   API sentinel back to `NaN` to preserve spec parity. Two-byte strings fall
		*   back to the uncurried `String.prototype.charCodeAt`.
		*
		*   ## Fast API surface — and why it's small
		*
		*   Mirrors the design rationale from socket-btm's `primordial_binding.cc`
		*   (lines 41-72). The smol Fast API exposes exactly one string op
		*   (`stringCharCodeAt`) because that's the one shape where the C++ trampoline
		*   genuinely beats V8's existing hot path: a single ASCII byte load, no
		*   encoding dispatch, no HandleScope, returns a primitive. String **searches**
		*   (`startsWith` / `endsWith` / `includes` / `indexOf` / `lastIndexOf`) are
		*   intentionally NOT exposed. V8's existing hot path dispatches on encoding
		*   and runs native SIMD memcmp — a Fast API binding would add overhead without
		*   winning. Same for `Map.has` / `Set.has` / `Array.includes`. Fast API also
		*   has a hard constraint: a fast-path function cannot return a new V8 object —
		*   only primitives, Local<Value/Object/Array>, or FastOneByteString. That
		*   rules out anything that produces a new string (`slice`, `substring`,
		*   `toUpperCase`, `concat`, `repeat`, `padStart`/`padEnd`, formatted-number)
		*   from ever being a Fast API win on the return path. Net: the current surface
		*   is approximately the ceiling. Adding more Fast API string ops without a
		*   flamegraph showing the cost is a regression risk, not a perf win. See
		*   `socket-btm/packages/node-smol-builder/additions/source-patched/`
		*   `src/socketsecurity/primordial/primordial_binding.cc:41-72` for the
		*   canonical design statement.
		*/
		const smolPrimordial = require_primordial().getSmolPrimordial();
		const StringCtor = String;
		const StringFromCharCode = String.fromCharCode;
		const StringFromCodePoint = String.fromCodePoint;
		const StringRaw = String.raw;
		const StringPrototypeAt = require_primordials_uncurry.uncurryThis(String.prototype.at);
		const StringPrototypeCharAt = require_primordials_uncurry.uncurryThis(String.prototype.charAt);
		const smolCharCodeAt = smolPrimordial?.stringCharCodeAt;
		/* c8 ignore start - smol Node fast path unreachable on stock Node test runner */
		const StringPrototypeCharCodeAt = smolCharCodeAt ? (s, i) => {
			const code = smolCharCodeAt(s, i);
			return code === -1 ? NaN : code;
		} : require_primordials_uncurry.uncurryThis(String.prototype.charCodeAt);
		/* c8 ignore stop */
		const StringPrototypeCodePointAt = require_primordials_uncurry.uncurryThis(String.prototype.codePointAt);
		const StringPrototypeConcat = require_primordials_uncurry.uncurryThis(String.prototype.concat);
		const StringPrototypeEndsWith = require_primordials_uncurry.uncurryThis(String.prototype.endsWith);
		const StringPrototypeIncludes = require_primordials_uncurry.uncurryThis(String.prototype.includes);
		const StringPrototypeIndexOf = require_primordials_uncurry.uncurryThis(String.prototype.indexOf);
		const StringPrototypeIsWellFormed = smolPrimordial?.stringIsWellFormed ?? require_primordials_uncurry.uncurryThis(String.prototype.isWellFormed);
		const StringPrototypeLastIndexOf = require_primordials_uncurry.uncurryThis(String.prototype.lastIndexOf);
		const StringPrototypeLocaleCompare = require_primordials_uncurry.uncurryThis(String.prototype.localeCompare);
		const StringPrototypeMatch = require_primordials_uncurry.uncurryThis(String.prototype.match);
		const StringPrototypeMatchAll = require_primordials_uncurry.uncurryThis(String.prototype.matchAll);
		const StringPrototypeNormalize = require_primordials_uncurry.uncurryThis(String.prototype.normalize);
		const StringPrototypePadEnd = require_primordials_uncurry.uncurryThis(String.prototype.padEnd);
		const StringPrototypePadStart = require_primordials_uncurry.uncurryThis(String.prototype.padStart);
		const StringPrototypeRepeat = require_primordials_uncurry.uncurryThis(String.prototype.repeat);
		const StringPrototypeReplace = require_primordials_uncurry.uncurryThis(String.prototype.replace);
		const StringPrototypeReplaceAll = require_primordials_uncurry.uncurryThis(String.prototype.replaceAll);
		const StringPrototypeSearch = require_primordials_uncurry.uncurryThis(String.prototype.search);
		const StringPrototypeSlice = require_primordials_uncurry.uncurryThis(String.prototype.slice);
		const StringPrototypeSplit = require_primordials_uncurry.uncurryThis(String.prototype.split);
		const StringPrototypeStartsWith = require_primordials_uncurry.uncurryThis(String.prototype.startsWith);
		const StringPrototypeSubstring = require_primordials_uncurry.uncurryThis(String.prototype.substring);
		const StringPrototypeToLocaleLowerCase = require_primordials_uncurry.uncurryThis(String.prototype.toLocaleLowerCase);
		const StringPrototypeToLocaleUpperCase = require_primordials_uncurry.uncurryThis(String.prototype.toLocaleUpperCase);
		const StringPrototypeToLowerCase = require_primordials_uncurry.uncurryThis(String.prototype.toLowerCase);
		const StringPrototypeToString = require_primordials_uncurry.uncurryThis(String.prototype.toString);
		const StringPrototypeToUpperCase = require_primordials_uncurry.uncurryThis(String.prototype.toUpperCase);
		const StringPrototypeToWellFormed = require_primordials_uncurry.uncurryThis(String.prototype.toWellFormed);
		const StringPrototypeTrim = require_primordials_uncurry.uncurryThis(String.prototype.trim);
		const StringPrototypeTrimEnd = require_primordials_uncurry.uncurryThis(String.prototype.trimEnd);
		const StringPrototypeTrimStart = require_primordials_uncurry.uncurryThis(String.prototype.trimStart);
		const StringPrototypeValueOf = require_primordials_uncurry.uncurryThis(String.prototype.valueOf);
		exports$10.StringCtor = StringCtor;
		exports$10.StringFromCharCode = StringFromCharCode;
		exports$10.StringFromCodePoint = StringFromCodePoint;
		exports$10.StringPrototypeAt = StringPrototypeAt;
		exports$10.StringPrototypeCharAt = StringPrototypeCharAt;
		exports$10.StringPrototypeCharCodeAt = StringPrototypeCharCodeAt;
		exports$10.StringPrototypeCodePointAt = StringPrototypeCodePointAt;
		exports$10.StringPrototypeConcat = StringPrototypeConcat;
		exports$10.StringPrototypeEndsWith = StringPrototypeEndsWith;
		exports$10.StringPrototypeIncludes = StringPrototypeIncludes;
		exports$10.StringPrototypeIndexOf = StringPrototypeIndexOf;
		exports$10.StringPrototypeIsWellFormed = StringPrototypeIsWellFormed;
		exports$10.StringPrototypeLastIndexOf = StringPrototypeLastIndexOf;
		exports$10.StringPrototypeLocaleCompare = StringPrototypeLocaleCompare;
		exports$10.StringPrototypeMatch = StringPrototypeMatch;
		exports$10.StringPrototypeMatchAll = StringPrototypeMatchAll;
		exports$10.StringPrototypeNormalize = StringPrototypeNormalize;
		exports$10.StringPrototypePadEnd = StringPrototypePadEnd;
		exports$10.StringPrototypePadStart = StringPrototypePadStart;
		exports$10.StringPrototypeRepeat = StringPrototypeRepeat;
		exports$10.StringPrototypeReplace = StringPrototypeReplace;
		exports$10.StringPrototypeReplaceAll = StringPrototypeReplaceAll;
		exports$10.StringPrototypeSearch = StringPrototypeSearch;
		exports$10.StringPrototypeSlice = StringPrototypeSlice;
		exports$10.StringPrototypeSplit = StringPrototypeSplit;
		exports$10.StringPrototypeStartsWith = StringPrototypeStartsWith;
		exports$10.StringPrototypeSubstring = StringPrototypeSubstring;
		exports$10.StringPrototypeToLocaleLowerCase = StringPrototypeToLocaleLowerCase;
		exports$10.StringPrototypeToLocaleUpperCase = StringPrototypeToLocaleUpperCase;
		exports$10.StringPrototypeToLowerCase = StringPrototypeToLowerCase;
		exports$10.StringPrototypeToString = StringPrototypeToString;
		exports$10.StringPrototypeToUpperCase = StringPrototypeToUpperCase;
		exports$10.StringPrototypeToWellFormed = StringPrototypeToWellFormed;
		exports$10.StringPrototypeTrim = StringPrototypeTrim;
		exports$10.StringPrototypeTrimEnd = StringPrototypeTrimEnd;
		exports$10.StringPrototypeTrimStart = StringPrototypeTrimStart;
		exports$10.StringPrototypeValueOf = StringPrototypeValueOf;
		exports$10.StringRaw = StringRaw;
	}));
	var import_purl = require_purl();
	var import_error = require_error();
	var import_map_set = require_map_set();
	var import_regexp = require_regexp();
	var import_string = require_string();
	let cachedPackageURL$2;
	/**
	* @internal Register the `PackageURL` class for string parsing in compare functions.
	*/
	function registerPackageURL(ctor) {
		cachedPackageURL$2 = ctor;
	}
	function toCanonicalString(input) {
		if (typeof input === "string") {
			/* v8 ignore start -- PackageURL is always registered at module load time. */
			if (!cachedPackageURL$2) throw new import_error.ErrorCtor("PackageURL not registered. Import PackageURL before using string comparison.");
			/* v8 ignore stop */
			return cachedPackageURL$2.fromString(input).toString();
		}
		return input.toString();
	}
	/**
	* Cache for compiled wildcard regexes to avoid recompilation on repeated calls.
	* Bounded to `1024` entries with LRU eviction (same strategy as flyweight
	* cache).
	*/
	const wildcardRegexCache = new import_map_set.MapCtor();
	const WILDCARD_CACHE_MAX = 1024;
	/**
	* Simple wildcard matcher for PURL components. A `*` matches any run of
	* characters, a `?` matches a single character, and `**` matches anything
	* including an empty string. Designed for version strings and package names,
	* not file paths.
	*/
	const MAX_PATTERN_LENGTH = 4096;
	const MAX_WILDCARDS_PER_PATTERN = 32;
	function countWildcards(pattern) {
		let count = 0;
		for (let i = 0, { length } = pattern; i < length; i += 1) {
			const code = (0, import_string.StringPrototypeCharCodeAt)(pattern, i);
			if (code === 42 || code === 63) count += 1;
		}
		return count;
	}
	function matchWildcard(pattern, value) {
		let regex = wildcardRegexCache.get(pattern);
		if (regex === void 0) {
			if (pattern.length > MAX_PATTERN_LENGTH) return false;
			if (countWildcards(pattern) > MAX_WILDCARDS_PER_PATTERN) return false;
			regex = new import_regexp.RegExpCtor(`^${(0, import_string.StringPrototypeReplace)((0, import_string.StringPrototypeReplace)((0, import_string.StringPrototypeReplace)((0, import_string.StringPrototypeReplace)(pattern, /[.+^${}()|[\]\\]/g, "\\$&"), /\*/g, ".*"), /\?/g, "."), /(?:\.\*)+/g, ".*")}$`);
			if (wildcardRegexCache.size >= WILDCARD_CACHE_MAX) wildcardRegexCache.delete(wildcardRegexCache.keys().next().value);
			wildcardRegexCache.set(pattern, regex);
		} else {
			wildcardRegexCache.delete(pattern);
			wildcardRegexCache.set(pattern, regex);
		}
		return (0, import_regexp.RegExpPrototypeTest)(regex, value);
	}
	/**
	* Match a single component value against a pattern. Handles wildcard matching
	* for individual PURL components.
	*/
	function matchComponent(patternValue, actualValue, matcher) {
		if (patternValue === "**") return true;
		if (patternValue === null || patternValue === void 0 || patternValue === "") return actualValue === null || actualValue === void 0 || actualValue === "";
		if (actualValue === null || actualValue === void 0 || actualValue === "") return false;
		if (matcher) return matcher(actualValue);
		if ((0, import_string.StringPrototypeIncludes)(patternValue, "*") || (0, import_string.StringPrototypeIncludes)(patternValue, "?")) return matchWildcard(patternValue, actualValue);
		return patternValue === actualValue;
	}
	/**
	* Compare two `PackageURL`s for equality.
	*
	* Two `purl`s are considered equal if their canonical string representations
	* match. This comparison is case-sensitive after normalization.
	*
	* Accepts both `PackageURL` instances and PURL strings. Strings are parsed and
	* normalized before comparison.
	*
	* @example
	*   ;```typescript
	*   const purl1 = PackageURL.fromString('pkg:npm/lodash@4.17.21')
	*   const purl2 = PackageURL.fromString('pkg:npm/lodash@4.17.21')
	*
	*   equalsPurls(purl1, purl2) // -> true
	*   equalsPurls('pkg:npm/lodash@4.17.21', 'pkg:NPM/lodash@4.17.21') // -> true
	*   equalsPurls(purl1, 'pkg:npm/lodash@4.17.20') // -> false
	*   ```
	*
	* @param a - First `PackageURL` or PURL string to compare.
	* @param b - Second `PackageURL` or PURL string to compare.
	*
	* @returns `true` if the `purl`s are equal, `false` otherwise
	*/
	function equalsPurls(a, b) {
		return toCanonicalString(a) === toCanonicalString(b);
	}
	/**
	* Compare two `PackageURL`s for sorting.
	*
	* Returns a number indicating sort order: - Negative if `a` comes before `b` -
	* Zero if they are equal - Positive if `a` comes after `b`
	*
	* Comparison is based on canonical string representation (lexicographic).
	*
	* Accepts both `PackageURL` instances and PURL strings. Strings are parsed and
	* normalized before comparison.
	*
	* @example
	*   ;```typescript
	*   comparePurls('pkg:npm/aaa', 'pkg:npm/bbb') // -> -1
	*   comparePurls(
	*     'pkg:npm/bbb',
	*     'pkg:npm/aaa',
	*   ) // -> 1
	*   // Use with Array.sort
	*   [('pkg:npm/bbb', 'pkg:npm/aaa')].sort(comparePurls)
	*   // -> ['pkg:npm/aaa', 'pkg:npm/bbb']
	*   ```
	*
	* @param a - First `PackageURL` or PURL string to compare.
	* @param b - Second `PackageURL` or PURL string to compare.
	*
	* @returns `-1`, `0`, or `1` for sort ordering
	*/
	function comparePurls(a, b) {
		const aStr = toCanonicalString(a);
		const bStr = toCanonicalString(b);
		if (aStr < bStr) return -1;
		if (aStr > bStr) return 1;
		return 0;
	}
	/**
	* Parse a PURL pattern string into its individual components. Strips the `pkg:`
	* prefix, extracts `type`/`namespace`/`name`/`version`, handles scoped `@`
	* prefixes, and applies type-specific normalization (`npm` lowercase, `pypi`
	* underscore-to-hyphen).
	*
	* Returns `undefined` if the pattern is not a valid PURL pattern shape.
	*/
	function parsePattern(pattern) {
		if (!(0, import_string.StringPrototypeStartsWith)(pattern, "pkg:")) return;
		const patternWithoutScheme = (0, import_string.StringPrototypeSlice)(pattern, 4);
		const typeEndIndex = (0, import_string.StringPrototypeIndexOf)(patternWithoutScheme, "/");
		if (typeEndIndex === -1) return;
		let typePattern = (0, import_string.StringPrototypeSlice)(patternWithoutScheme, 0, typeEndIndex);
		const remaining = (0, import_string.StringPrototypeSlice)(patternWithoutScheme, typeEndIndex + 1);
		let namespacePattern;
		let namePattern;
		let versionPattern;
		const versionSeparatorIndex = (0, import_string.StringPrototypeStartsWith)(remaining, "@") ? (0, import_string.StringPrototypeIndexOf)(remaining, "@", 1) : (0, import_string.StringPrototypeIndexOf)(remaining, "@");
		let beforeVersion;
		if (versionSeparatorIndex !== -1) {
			beforeVersion = (0, import_string.StringPrototypeSlice)(remaining, 0, versionSeparatorIndex);
			versionPattern = (0, import_string.StringPrototypeSlice)(remaining, versionSeparatorIndex + 1);
		} else beforeVersion = remaining;
		const lastSlashIndex = (0, import_string.StringPrototypeLastIndexOf)(beforeVersion, "/");
		if (lastSlashIndex !== -1) {
			namespacePattern = (0, import_string.StringPrototypeSlice)(beforeVersion, 0, lastSlashIndex);
			namePattern = (0, import_string.StringPrototypeSlice)(beforeVersion, lastSlashIndex + 1);
		} else namePattern = beforeVersion;
		typePattern = (0, import_string.StringPrototypeToLowerCase)(typePattern);
		if (typePattern === "npm") {
			if (namespacePattern) namespacePattern = (0, import_string.StringPrototypeToLowerCase)(namespacePattern);
			namePattern = (0, import_string.StringPrototypeToLowerCase)(namePattern);
		}
		if (typePattern === "pypi") namePattern = (0, import_string.StringPrototypeReplace)((0, import_string.StringPrototypeToLowerCase)(namePattern), /_/g, "-");
		return {
			typePattern,
			namespacePattern,
			namePattern,
			versionPattern
		};
	}
	/**
	* Check if a `PackageURL` matches a pattern with wildcards.
	*
	* Supports glob-style wildcards: - asterisk matches any sequence of characters
	* within a component - double asterisk matches any value including empty (for
	* optional components) - question mark matches single character.
	*
	* Pattern matching is performed on normalized `purl`s (after type-specific
	* normalization). Each component is matched independently.
	*
	* @example
	*   Wildcard in name: `matchesPurl('pkg:npm/lodash-star', purl)`
	*   Wildcard in namespace: `matchesPurl('pkg:npm/@babel/star', purl)`
	*   Wildcard in version: `matchesPurl('pkg:npm/react@18.star', purl)`
	*   Match any type: `matchesPurl('pkg:star/lodash', purl)`
	*   Optional version: `matchesPurl('pkg:npm/lodash@star-star', purl)`
	*
	*   See `test/pattern-matching.test.mts` for comprehensive examples.
	*
	* @param pattern - PURL string with wildcards.
	* @param purl - `PackageURL` instance to test.
	*
	* @returns `true` if `purl` matches the pattern
	*/
	function matchesPurl(pattern, purl) {
		const parsed = parsePattern(pattern);
		if (!parsed) return false;
		const { typePattern, namespacePattern, namePattern, versionPattern } = parsed;
		return matchComponent(typePattern, purl.type) && matchComponent(namespacePattern, purl.namespace) && matchComponent(namePattern, purl.name) && matchComponent(versionPattern, purl.version);
	}
	/**
	* Create a reusable matcher function from a pattern. More efficient for testing
	* multiple `purl`s against the same pattern.
	*
	* The returned function can be used with `Array` methods like `filter()`,
	* `some()`, and `every()` for efficient batch matching operations.
	*
	* @example
	*   `const isBabel = createMatcher('pkg:npm/@babel/star')`
	*   `packages.filter(isBabel)`
	*
	*   See `test/pattern-matching.test.mts` for comprehensive examples.
	*
	* @param pattern - PURL pattern string with wildcards.
	*
	* @returns Function that tests `purl`s against the pattern
	*/
	function createMatcher(pattern) {
		const parsed = parsePattern(pattern);
		if (!parsed) return () => false;
		const { typePattern, namespacePattern, namePattern, versionPattern } = parsed;
		const typeMatcher = typePattern && ((0, import_string.StringPrototypeIncludes)(typePattern, "*") || (0, import_string.StringPrototypeIncludes)(typePattern, "?")) ? (value) => matchWildcard(typePattern, value) : void 0;
		const namespaceMatcher = namespacePattern && ((0, import_string.StringPrototypeIncludes)(namespacePattern, "*") || (0, import_string.StringPrototypeIncludes)(namespacePattern, "?")) && namespacePattern ? (value) => matchWildcard(namespacePattern, value) : void 0;
		const nameMatcher = namePattern && ((0, import_string.StringPrototypeIncludes)(namePattern, "*") || (0, import_string.StringPrototypeIncludes)(namePattern, "?")) ? (value) => matchWildcard(namePattern, value) : void 0;
		const versionMatcher = versionPattern && ((0, import_string.StringPrototypeIncludes)(versionPattern, "*") || (0, import_string.StringPrototypeIncludes)(versionPattern, "?")) && versionPattern ? (value) => matchWildcard(versionPattern, value) : void 0;
		return (_purl) => {
			return matchComponent(typePattern, _purl.type, typeMatcher) && matchComponent(namespacePattern, _purl.namespace, namespaceMatcher) && matchComponent(namePattern, _purl.name, nameMatcher) && matchComponent(versionPattern, _purl.version, versionMatcher);
		};
	}
	var require_array = /* @__PURE__ */ __commonJSMin(((exports$11) => {
		Object.defineProperty(exports$11, Symbol.toStringTag, { value: "Module" });
		const require_primordials_uncurry = require_uncurry();
		/**
		* @file Safe references to `Array`, typed-array, `ArrayBuffer`, `DataView`,
		*   `Atomics`, and shared iterator-prototype primordials. `Array.fromAsync` and
		*   `Array.prototype.with` are ES2024 / ES2023; the primordial captures the
		*   live reference at module load so consumers never see a tampered global.
		*/
		const smolPrimordial = require_primordial().getSmolPrimordial();
		const ArrayCtor = Array;
		const ArrayBufferCtor = ArrayBuffer;
		const DataViewCtor = DataView;
		const Float32ArrayCtor = Float32Array;
		const Float64ArrayCtor = Float64Array;
		const Int8ArrayCtor = Int8Array;
		const Int16ArrayCtor = Int16Array;
		const Int32ArrayCtor = Int32Array;
		const Uint8ArrayCtor = Uint8Array;
		const Uint8ClampedArrayCtor = Uint8ClampedArray;
		const Uint16ArrayCtor = Uint16Array;
		const Uint32ArrayCtor = Uint32Array;
		const ArrayFrom = Array.from;
		const ArrayFromAsync = Array.fromAsync;
		const ArrayIsArray = smolPrimordial?.arrayIsArray ?? Array.isArray;
		const ArrayOf = Array.of;
		const ArrayBufferIsView = ArrayBuffer.isView;
		const AtomicsWait = Atomics.wait;
		const ArrayPrototypeAt = require_primordials_uncurry.uncurryThis(Array.prototype.at);
		const ArrayPrototypeConcat = require_primordials_uncurry.uncurryThis(Array.prototype.concat);
		const ArrayPrototypeCopyWithin = require_primordials_uncurry.uncurryThis(Array.prototype.copyWithin);
		const ArrayPrototypeEntries = require_primordials_uncurry.uncurryThis(Array.prototype.entries);
		const ArrayPrototypeEvery = require_primordials_uncurry.uncurryThis(Array.prototype.every);
		const ArrayPrototypeFill = require_primordials_uncurry.uncurryThis(Array.prototype.fill);
		const ArrayPrototypeFilter = require_primordials_uncurry.uncurryThis(Array.prototype.filter);
		const ArrayPrototypeFind = require_primordials_uncurry.uncurryThis(Array.prototype.find);
		const ArrayPrototypeFindIndex = require_primordials_uncurry.uncurryThis(Array.prototype.findIndex);
		const ArrayPrototypeFindLast = require_primordials_uncurry.uncurryThis(Array.prototype.findLast);
		const ArrayPrototypeFindLastIndex = require_primordials_uncurry.uncurryThis(Array.prototype.findLastIndex);
		const ArrayPrototypeFlat = require_primordials_uncurry.uncurryThis(Array.prototype.flat);
		const ArrayPrototypeFlatMap = require_primordials_uncurry.uncurryThis(Array.prototype.flatMap);
		const ArrayPrototypeForEach = require_primordials_uncurry.uncurryThis(Array.prototype.forEach);
		const ArrayPrototypeIncludes = require_primordials_uncurry.uncurryThis(Array.prototype.includes);
		const ArrayPrototypeIndexOf = require_primordials_uncurry.uncurryThis(Array.prototype.indexOf);
		const ArrayPrototypeJoin = require_primordials_uncurry.uncurryThis(Array.prototype.join);
		const ArrayPrototypeKeys = require_primordials_uncurry.uncurryThis(Array.prototype.keys);
		const ArrayPrototypeLastIndexOf = require_primordials_uncurry.uncurryThis(Array.prototype.lastIndexOf);
		const ArrayPrototypeMap = require_primordials_uncurry.uncurryThis(Array.prototype.map);
		const ArrayPrototypePop = require_primordials_uncurry.uncurryThis(Array.prototype.pop);
		const ArrayPrototypePush = require_primordials_uncurry.uncurryThis(Array.prototype.push);
		const ArrayPrototypeReduce = require_primordials_uncurry.uncurryThis(Array.prototype.reduce);
		const ArrayPrototypeReduceRight = require_primordials_uncurry.uncurryThis(Array.prototype.reduceRight);
		const ArrayPrototypeReverse = require_primordials_uncurry.uncurryThis(Array.prototype.reverse);
		const ArrayPrototypeShift = require_primordials_uncurry.uncurryThis(Array.prototype.shift);
		const ArrayPrototypeSlice = require_primordials_uncurry.uncurryThis(Array.prototype.slice);
		const ArrayPrototypeSome = require_primordials_uncurry.uncurryThis(Array.prototype.some);
		const ArrayPrototypeSort = require_primordials_uncurry.uncurryThis(Array.prototype.sort);
		const ArrayPrototypeSplice = require_primordials_uncurry.uncurryThis(Array.prototype.splice);
		const ArrayPrototypeToLocaleString = require_primordials_uncurry.uncurryThis(Array.prototype.toLocaleString);
		const ArrayPrototypeToReversed = require_primordials_uncurry.uncurryThis(Array.prototype.toReversed);
		const ArrayPrototypeToSorted = require_primordials_uncurry.uncurryThis(Array.prototype.toSorted);
		const ArrayPrototypeToSpliced = require_primordials_uncurry.uncurryThis(Array.prototype.toSpliced);
		const ArrayPrototypeToString = require_primordials_uncurry.uncurryThis(Array.prototype.toString);
		const ArrayPrototypeUnshift = require_primordials_uncurry.uncurryThis(Array.prototype.unshift);
		const ArrayPrototypeValues = require_primordials_uncurry.uncurryThis(Array.prototype.values);
		const ArrayPrototypeWith = require_primordials_uncurry.uncurryThis(Array.prototype.with);
		const anyIterator = (/* @__PURE__ */ new Map()).keys();
		let iteratorLookup = Object.getPrototypeOf(anyIterator);
		while (iteratorLookup && typeof iteratorLookup.next !== "function")
 /* c8 ignore next - Modern V8 puts Iterator.prototype one hop up the chain
		so the first check already finds .next; the walk-further branch fires
		only on hypothetical engines where the prototype layout differs. */
		iteratorLookup = Object.getPrototypeOf(iteratorLookup);
		const iteratorProto = iteratorLookup;
		const IteratorPrototypeNext = require_primordials_uncurry.uncurryThis(iteratorProto.next);
		/* c8 ignore start */
		const IteratorPrototypeReturn = typeof iteratorProto.return === "function" ? require_primordials_uncurry.uncurryThis(iteratorProto.return) : void 0;
		/* c8 ignore stop */
		exports$11.ArrayBufferCtor = ArrayBufferCtor;
		exports$11.ArrayBufferIsView = ArrayBufferIsView;
		exports$11.ArrayCtor = ArrayCtor;
		exports$11.ArrayFrom = ArrayFrom;
		exports$11.ArrayFromAsync = ArrayFromAsync;
		exports$11.ArrayIsArray = ArrayIsArray;
		exports$11.ArrayOf = ArrayOf;
		exports$11.ArrayPrototypeAt = ArrayPrototypeAt;
		exports$11.ArrayPrototypeConcat = ArrayPrototypeConcat;
		exports$11.ArrayPrototypeCopyWithin = ArrayPrototypeCopyWithin;
		exports$11.ArrayPrototypeEntries = ArrayPrototypeEntries;
		exports$11.ArrayPrototypeEvery = ArrayPrototypeEvery;
		exports$11.ArrayPrototypeFill = ArrayPrototypeFill;
		exports$11.ArrayPrototypeFilter = ArrayPrototypeFilter;
		exports$11.ArrayPrototypeFind = ArrayPrototypeFind;
		exports$11.ArrayPrototypeFindIndex = ArrayPrototypeFindIndex;
		exports$11.ArrayPrototypeFindLast = ArrayPrototypeFindLast;
		exports$11.ArrayPrototypeFindLastIndex = ArrayPrototypeFindLastIndex;
		exports$11.ArrayPrototypeFlat = ArrayPrototypeFlat;
		exports$11.ArrayPrototypeFlatMap = ArrayPrototypeFlatMap;
		exports$11.ArrayPrototypeForEach = ArrayPrototypeForEach;
		exports$11.ArrayPrototypeIncludes = ArrayPrototypeIncludes;
		exports$11.ArrayPrototypeIndexOf = ArrayPrototypeIndexOf;
		exports$11.ArrayPrototypeJoin = ArrayPrototypeJoin;
		exports$11.ArrayPrototypeKeys = ArrayPrototypeKeys;
		exports$11.ArrayPrototypeLastIndexOf = ArrayPrototypeLastIndexOf;
		exports$11.ArrayPrototypeMap = ArrayPrototypeMap;
		exports$11.ArrayPrototypePop = ArrayPrototypePop;
		exports$11.ArrayPrototypePush = ArrayPrototypePush;
		exports$11.ArrayPrototypeReduce = ArrayPrototypeReduce;
		exports$11.ArrayPrototypeReduceRight = ArrayPrototypeReduceRight;
		exports$11.ArrayPrototypeReverse = ArrayPrototypeReverse;
		exports$11.ArrayPrototypeShift = ArrayPrototypeShift;
		exports$11.ArrayPrototypeSlice = ArrayPrototypeSlice;
		exports$11.ArrayPrototypeSome = ArrayPrototypeSome;
		exports$11.ArrayPrototypeSort = ArrayPrototypeSort;
		exports$11.ArrayPrototypeSplice = ArrayPrototypeSplice;
		exports$11.ArrayPrototypeToLocaleString = ArrayPrototypeToLocaleString;
		exports$11.ArrayPrototypeToReversed = ArrayPrototypeToReversed;
		exports$11.ArrayPrototypeToSorted = ArrayPrototypeToSorted;
		exports$11.ArrayPrototypeToSpliced = ArrayPrototypeToSpliced;
		exports$11.ArrayPrototypeToString = ArrayPrototypeToString;
		exports$11.ArrayPrototypeUnshift = ArrayPrototypeUnshift;
		exports$11.ArrayPrototypeValues = ArrayPrototypeValues;
		exports$11.ArrayPrototypeWith = ArrayPrototypeWith;
		exports$11.AtomicsWait = AtomicsWait;
		exports$11.DataViewCtor = DataViewCtor;
		exports$11.Float32ArrayCtor = Float32ArrayCtor;
		exports$11.Float64ArrayCtor = Float64ArrayCtor;
		exports$11.Int16ArrayCtor = Int16ArrayCtor;
		exports$11.Int32ArrayCtor = Int32ArrayCtor;
		exports$11.Int8ArrayCtor = Int8ArrayCtor;
		exports$11.IteratorPrototypeNext = IteratorPrototypeNext;
		exports$11.IteratorPrototypeReturn = IteratorPrototypeReturn;
		exports$11.Uint16ArrayCtor = Uint16ArrayCtor;
		exports$11.Uint32ArrayCtor = Uint32ArrayCtor;
		exports$11.Uint8ArrayCtor = Uint8ArrayCtor;
		exports$11.Uint8ClampedArrayCtor = Uint8ClampedArrayCtor;
	}));
	var require_object = /* @__PURE__ */ __commonJSMin(((exports$12) => {
		Object.defineProperty(exports$12, Symbol.toStringTag, { value: "Module" });
		const require_primordials_uncurry = require_uncurry();
		/**
		* @file Safe references to `Object` static methods and prototype methods. Annex
		*   B legacy accessor methods (`__defineGetter__`, `__lookupGetter__`, etc.)
		*   are exposed alongside the canonical static methods — implementations exist
		*   in V8, SpiderMonkey, and JavaScriptCore even though the spec calls them
		*   "normative optional".
		*/
		const ObjectCtor = Object;
		const ObjectAssign = Object.assign;
		const ObjectCreate = Object.create;
		const ObjectDefineProperties = Object.defineProperties;
		const ObjectDefineProperty = Object.defineProperty;
		const ObjectEntries = Object.entries;
		const ObjectFreeze = Object.freeze;
		const ObjectFromEntries = Object.fromEntries;
		const ObjectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
		const ObjectGetOwnPropertyDescriptors = Object.getOwnPropertyDescriptors;
		const ObjectGetOwnPropertyNames = Object.getOwnPropertyNames;
		const ObjectGetOwnPropertySymbols = Object.getOwnPropertySymbols;
		const ObjectGetPrototypeOf = Object.getPrototypeOf;
		const ObjectHasOwn = Object.hasOwn;
		const ObjectIs = Object.is;
		const ObjectIsExtensible = Object.isExtensible;
		const ObjectIsFrozen = Object.isFrozen;
		const ObjectIsSealed = Object.isSealed;
		const ObjectKeys = Object.keys;
		const ObjectPreventExtensions = Object.preventExtensions;
		const ObjectSeal = Object.seal;
		const ObjectSetPrototypeOf = Object.setPrototypeOf;
		const ObjectValues = Object.values;
		const ObjectPrototype = Object.prototype;
		const ObjectPrototypeHasOwnProperty = require_primordials_uncurry.uncurryThis(Object.prototype.hasOwnProperty);
		const ObjectPrototypeIsPrototypeOf = require_primordials_uncurry.uncurryThis(Object.prototype.isPrototypeOf);
		const ObjectPrototypePropertyIsEnumerable = require_primordials_uncurry.uncurryThis(Object.prototype.propertyIsEnumerable);
		const ObjectPrototypeToString = require_primordials_uncurry.uncurryThis(Object.prototype.toString);
		const ObjectPrototypeValueOf = require_primordials_uncurry.uncurryThis(Object.prototype.valueOf);
		const objectProto = Object.prototype;
		const ObjectPrototypeDefineGetter = require_primordials_uncurry.uncurryThis(objectProto.__defineGetter__);
		const ObjectPrototypeDefineSetter = require_primordials_uncurry.uncurryThis(objectProto.__defineSetter__);
		const ObjectPrototypeLookupGetter = require_primordials_uncurry.uncurryThis(objectProto.__lookupGetter__);
		const ObjectPrototypeLookupSetter = require_primordials_uncurry.uncurryThis(objectProto.__lookupSetter__);
		exports$12.ObjectAssign = ObjectAssign;
		exports$12.ObjectCreate = ObjectCreate;
		exports$12.ObjectCtor = ObjectCtor;
		exports$12.ObjectDefineProperties = ObjectDefineProperties;
		exports$12.ObjectDefineProperty = ObjectDefineProperty;
		exports$12.ObjectEntries = ObjectEntries;
		exports$12.ObjectFreeze = ObjectFreeze;
		exports$12.ObjectFromEntries = ObjectFromEntries;
		exports$12.ObjectGetOwnPropertyDescriptor = ObjectGetOwnPropertyDescriptor;
		exports$12.ObjectGetOwnPropertyDescriptors = ObjectGetOwnPropertyDescriptors;
		exports$12.ObjectGetOwnPropertyNames = ObjectGetOwnPropertyNames;
		exports$12.ObjectGetOwnPropertySymbols = ObjectGetOwnPropertySymbols;
		exports$12.ObjectGetPrototypeOf = ObjectGetPrototypeOf;
		exports$12.ObjectHasOwn = ObjectHasOwn;
		exports$12.ObjectIs = ObjectIs;
		exports$12.ObjectIsExtensible = ObjectIsExtensible;
		exports$12.ObjectIsFrozen = ObjectIsFrozen;
		exports$12.ObjectIsSealed = ObjectIsSealed;
		exports$12.ObjectKeys = ObjectKeys;
		exports$12.ObjectPreventExtensions = ObjectPreventExtensions;
		exports$12.ObjectPrototype = ObjectPrototype;
		exports$12.ObjectPrototypeDefineGetter = ObjectPrototypeDefineGetter;
		exports$12.ObjectPrototypeDefineSetter = ObjectPrototypeDefineSetter;
		exports$12.ObjectPrototypeHasOwnProperty = ObjectPrototypeHasOwnProperty;
		exports$12.ObjectPrototypeIsPrototypeOf = ObjectPrototypeIsPrototypeOf;
		exports$12.ObjectPrototypeLookupGetter = ObjectPrototypeLookupGetter;
		exports$12.ObjectPrototypeLookupSetter = ObjectPrototypeLookupSetter;
		exports$12.ObjectPrototypePropertyIsEnumerable = ObjectPrototypePropertyIsEnumerable;
		exports$12.ObjectPrototypeToString = ObjectPrototypeToString;
		exports$12.ObjectPrototypeValueOf = ObjectPrototypeValueOf;
		exports$12.ObjectSeal = ObjectSeal;
		exports$12.ObjectSetPrototypeOf = ObjectSetPrototypeOf;
		exports$12.ObjectValues = ObjectValues;
	}));
	var require_reflect = /* @__PURE__ */ __commonJSMin(((exports$13) => {
		Object.defineProperty(exports$13, Symbol.toStringTag, { value: "Module" });
		/**
		* @file Safe references to `Reflect.*`. **IMPORTANT**: do not destructure on
		*   `Reflect` here. tsgo has a bug that mis-transpiles destructured exports.
		*   See: https://github.com/SocketDev/socket-packageurl-js/issues/3.
		*/
		const ReflectApply = Reflect.apply;
		const ReflectConstruct = Reflect.construct;
		const ReflectDefineProperty = Reflect.defineProperty;
		const ReflectDeleteProperty = Reflect.deleteProperty;
		const ReflectGet = Reflect.get;
		const ReflectGetOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor;
		const ReflectGetPrototypeOf = Reflect.getPrototypeOf;
		const ReflectHas = Reflect.has;
		const ReflectIsExtensible = Reflect.isExtensible;
		const ReflectOwnKeys = Reflect.ownKeys;
		const ReflectPreventExtensions = Reflect.preventExtensions;
		const ReflectSet = Reflect.set;
		const ReflectSetPrototypeOf = Reflect.setPrototypeOf;
		exports$13.ReflectApply = ReflectApply;
		exports$13.ReflectConstruct = ReflectConstruct;
		exports$13.ReflectDefineProperty = ReflectDefineProperty;
		exports$13.ReflectDeleteProperty = ReflectDeleteProperty;
		exports$13.ReflectGet = ReflectGet;
		exports$13.ReflectGetOwnPropertyDescriptor = ReflectGetOwnPropertyDescriptor;
		exports$13.ReflectGetPrototypeOf = ReflectGetPrototypeOf;
		exports$13.ReflectHas = ReflectHas;
		exports$13.ReflectIsExtensible = ReflectIsExtensible;
		exports$13.ReflectOwnKeys = ReflectOwnKeys;
		exports$13.ReflectPreventExtensions = ReflectPreventExtensions;
		exports$13.ReflectSet = ReflectSet;
		exports$13.ReflectSetPrototypeOf = ReflectSetPrototypeOf;
	}));
	/**
	* @file Object utility functions for type checking and immutable object
	*   creation. Provides object validation and recursive freezing utilities.
	*/
	var import_array = require_array();
	var import_object = require_object();
	var import_reflect = require_reflect();
	/**
	* Check if value is a non-null object. Inlined to avoid importing
	* `@socketsecurity/lib/objects` which transitively pulls in `sorts` → `semver`
	* → `npm-pack` (2.5 MB).
	*/
	function isObject(value) {
		return value !== null && typeof value === "object";
	}
	/**
	* Recursively freeze an object and all nested objects. Uses breadth-first
	* traversal with a queue for memory efficiency.
	*
	* @throws {Error} When object graph too large or circular reference detected.
	*/
	function recursiveFreeze(value_) {
		if (value_ === null || !(typeof value_ === "object" || typeof value_ === "function") || (0, import_object.ObjectIsFrozen)(value_)) return value_;
		const queue = [value_];
		const visited = new import_map_set.WeakSetCtor();
		visited.add(value_);
		let { length: queueLength } = queue;
		let pos = 0;
		while (pos < queueLength) {
			if (pos === 1e6) throw new import_error.ErrorCtor("Object graph too large (exceeds 1,000,000 items).");
			const obj = queue[pos++];
			(0, import_object.ObjectFreeze)(obj);
			if ((0, import_array.ArrayIsArray)(obj)) for (let i = 0, { length } = obj; i < length; i += 1) {
				const item = obj[i];
				if (item !== null && (typeof item === "object" || typeof item === "function") && !(0, import_object.ObjectIsFrozen)(item) && !visited.has(item)) {
					visited.add(item);
					queue[queueLength++] = item;
				}
			}
			else {
				const keys = (0, import_reflect.ReflectOwnKeys)(obj);
				for (let i = 0, { length } = keys; i < length; i += 1) {
					const propValue = obj[keys[i]];
					if (propValue !== null && (typeof propValue === "object" || typeof propValue === "function") && !(0, import_object.ObjectIsFrozen)(propValue) && !visited.has(propValue)) {
						visited.add(propValue);
						queue[queueLength++] = propValue;
					}
				}
			}
		}
		return value_;
	}
	var require_url = /* @__PURE__ */ __commonJSMin(((exports$14) => {
		Object.defineProperty(exports$14, Symbol.toStringTag, { value: "Module" });
		const require_primordials_uncurry = require_uncurry();
		/**
		* @file Safe references to `URL`, `URLSearchParams`, and the
		*   `URLSearchParams.prototype` methods.
		*/
		const URLCtor = URL;
		const URLSearchParamsCtor = URLSearchParams;
		/**
		* @unused No internal or Socket consumers; exercised only by its unit tests.
		*/
		const URLSearchParamsPrototypeAppend = require_primordials_uncurry.uncurryThis(URLSearchParams.prototype.append);
		/**
		* @unused No internal or Socket consumers; exercised only by its unit tests.
		*/
		const URLSearchParamsPrototypeDelete = require_primordials_uncurry.uncurryThis(URLSearchParams.prototype.delete);
		const URLSearchParamsPrototypeForEach = require_primordials_uncurry.uncurryThis(URLSearchParams.prototype.forEach);
		/**
		* @unused No internal or Socket consumers; exercised only by its unit tests.
		*/
		const URLSearchParamsPrototypeGet = require_primordials_uncurry.uncurryThis(URLSearchParams.prototype.get);
		/**
		* @unused No internal or Socket consumers; exercised only by its unit tests.
		*/
		const URLSearchParamsPrototypeGetAll = require_primordials_uncurry.uncurryThis(URLSearchParams.prototype.getAll);
		/**
		* @unused No internal or Socket consumers; exercised only by its unit tests.
		*/
		const URLSearchParamsPrototypeHas = require_primordials_uncurry.uncurryThis(URLSearchParams.prototype.has);
		/**
		* @unused No internal or Socket consumers; exercised only by its unit tests.
		*/
		const URLSearchParamsPrototypeSet = require_primordials_uncurry.uncurryThis(URLSearchParams.prototype.set);
		exports$14.URLCtor = URLCtor;
		exports$14.URLSearchParamsCtor = URLSearchParamsCtor;
		exports$14.URLSearchParamsPrototypeAppend = URLSearchParamsPrototypeAppend;
		exports$14.URLSearchParamsPrototypeDelete = URLSearchParamsPrototypeDelete;
		exports$14.URLSearchParamsPrototypeForEach = URLSearchParamsPrototypeForEach;
		exports$14.URLSearchParamsPrototypeGet = URLSearchParamsPrototypeGet;
		exports$14.URLSearchParamsPrototypeGetAll = URLSearchParamsPrototypeGetAll;
		exports$14.URLSearchParamsPrototypeHas = URLSearchParamsPrototypeHas;
		exports$14.URLSearchParamsPrototypeSet = URLSearchParamsPrototypeSet;
	}));
	var require_number = /* @__PURE__ */ __commonJSMin(((exports$15) => {
		Object.defineProperty(exports$15, Symbol.toStringTag, { value: "Module" });
		const require_primordials_uncurry = require_uncurry();
		/**
		* @file Safe references to `Number`, its constants, predicates, and parse
		*   helpers. Predicates prefer the smol fast-path (`node:smol-primordial`);
		*   static `parseFloat` / `parseInt` use the FastOneByteString-typed bindings
		*   for ASCII inputs and fall back to stock `Number.parse*` otherwise.
		*/
		const smolPrimordial = require_primordial().getSmolPrimordial();
		const NumberCtor = Number;
		const NumberEPSILON = Number.EPSILON;
		const NumberMAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;
		const NumberMAX_VALUE = Number.MAX_VALUE;
		const NumberMIN_SAFE_INTEGER = Number.MIN_SAFE_INTEGER;
		const NumberMIN_VALUE = Number.MIN_VALUE;
		const NumberNEGATIVE_INFINITY = Number.NEGATIVE_INFINITY;
		const NumberPOSITIVE_INFINITY = Number.POSITIVE_INFINITY;
		const NumberIsFinite = smolPrimordial?.numberIsFinite ?? Number.isFinite;
		const NumberIsInteger = smolPrimordial?.numberIsInteger ?? Number.isInteger;
		const NumberIsNaN = smolPrimordial?.numberIsNaN ?? Number.isNaN;
		const NumberIsSafeInteger = smolPrimordial?.numberIsSafeInteger ?? Number.isSafeInteger;
		const NumberParseFloat = smolPrimordial?.numberParseFloat ?? Number.parseFloat;
		const smolParseInt10 = smolPrimordial?.numberParseInt10;
		/* c8 ignore start - smol fast-path branch only reachable on socket-btm smol Node binary */
		const NumberParseInt = smolParseInt10 ? (s, radix) => radix === void 0 || radix === 10 ? smolParseInt10(s) : Number.parseInt(s, radix) : Number.parseInt;
		/* c8 ignore stop */
		const NumberPrototypeToExponential = require_primordials_uncurry.uncurryThis(Number.prototype.toExponential);
		const NumberPrototypeToFixed = require_primordials_uncurry.uncurryThis(Number.prototype.toFixed);
		const NumberPrototypeToPrecision = require_primordials_uncurry.uncurryThis(Number.prototype.toPrecision);
		const NumberPrototypeToString = require_primordials_uncurry.uncurryThis(Number.prototype.toString);
		const NumberPrototypeValueOf = require_primordials_uncurry.uncurryThis(Number.prototype.valueOf);
		exports$15.NumberCtor = NumberCtor;
		exports$15.NumberEPSILON = NumberEPSILON;
		exports$15.NumberIsFinite = NumberIsFinite;
		exports$15.NumberIsInteger = NumberIsInteger;
		exports$15.NumberIsNaN = NumberIsNaN;
		exports$15.NumberIsSafeInteger = NumberIsSafeInteger;
		exports$15.NumberMAX_SAFE_INTEGER = NumberMAX_SAFE_INTEGER;
		exports$15.NumberMAX_VALUE = NumberMAX_VALUE;
		exports$15.NumberMIN_SAFE_INTEGER = NumberMIN_SAFE_INTEGER;
		exports$15.NumberMIN_VALUE = NumberMIN_VALUE;
		exports$15.NumberNEGATIVE_INFINITY = NumberNEGATIVE_INFINITY;
		exports$15.NumberPOSITIVE_INFINITY = NumberPOSITIVE_INFINITY;
		exports$15.NumberParseFloat = NumberParseFloat;
		exports$15.NumberParseInt = NumberParseInt;
		exports$15.NumberPrototypeToExponential = NumberPrototypeToExponential;
		exports$15.NumberPrototypeToFixed = NumberPrototypeToFixed;
		exports$15.NumberPrototypeToPrecision = NumberPrototypeToPrecision;
		exports$15.NumberPrototypeToString = NumberPrototypeToString;
		exports$15.NumberPrototypeValueOf = NumberPrototypeValueOf;
	}));
	var import_url = require_url();
	var import_number = require_number();
	/**
	* Check if string contains only whitespace characters.
	*/
	function isBlank(str) {
		for (let i = 0, { length } = str; i < length; i += 1) {
			const code = (0, import_string.StringPrototypeCharCodeAt)(str, i);
			if (!(code === 32 || code === 9 || code === 10 || code === 11 || code === 12 || code === 13 || code === 160 || code === 5760 || code === 8192 || code === 8193 || code === 8194 || code === 8195 || code === 8196 || code === 8197 || code === 8198 || code === 8199 || code === 8200 || code === 8201 || code === 8202 || code === 8232 || code === 8233 || code === 8239 || code === 8287 || code === 12288 || code === 65279)) return false;
		}
		return true;
	}
	/**
	* Check if value is a non-empty string.
	*/
	function isNonEmptyString(value) {
		return typeof value === "string" && value.length > 0;
	}
	const regexSemverNumberedGroups$1 = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+(?:[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
	/**
	* Check if value is a valid semantic version string.
	*/
	function isSemverString(value) {
		return typeof value === "string" && (0, import_regexp.RegExpPrototypeTest)(regexSemverNumberedGroups$1, value);
	}
	/**
	* Convert package name to lowercase.
	*/
	function lowerName(purl) {
		purl.name = (0, import_string.StringPrototypeToLowerCase)(purl.name);
	}
	/**
	* Convert package namespace to lowercase.
	*/
	function lowerNamespace(purl) {
		const { namespace } = purl;
		if (typeof namespace === "string") purl.namespace = (0, import_string.StringPrototypeToLowerCase)(namespace);
	}
	/**
	* Convert package version to lowercase.
	*/
	function lowerVersion(purl) {
		const { version } = purl;
		if (typeof version === "string") purl.version = (0, import_string.StringPrototypeToLowerCase)(version);
	}
	/**
	* Replace all dashes with underscores in string.
	*/
	function replaceDashesWithUnderscores(str) {
		let result = "";
		let fromIndex = 0;
		let index = 0;
		while ((index = (0, import_string.StringPrototypeIndexOf)(str, "-", fromIndex)) !== -1) {
			result = `${result + (0, import_string.StringPrototypeSlice)(str, fromIndex, index)}_`;
			fromIndex = index + 1;
		}
		return fromIndex ? result + (0, import_string.StringPrototypeSlice)(str, fromIndex) : str;
	}
	/**
	* Replace all underscores with dashes in string.
	*/
	function replaceUnderscoresWithDashes(str) {
		let result = "";
		let fromIndex = 0;
		let index = 0;
		while ((index = (0, import_string.StringPrototypeIndexOf)(str, "_", fromIndex)) !== -1) {
			result = `${result + (0, import_string.StringPrototypeSlice)(str, fromIndex, index)}-`;
			fromIndex = index + 1;
		}
		return fromIndex ? result + (0, import_string.StringPrototypeSlice)(str, fromIndex) : str;
	}
	/**
	* Test whether a character code is an injection-dangerous character.
	*
	* Detects four classes of dangerous characters:
	*
	* 1. **Shell metacharacters** — command execution, piping, redirection, expansion:
	*    `|`, `&`, `;`, `` ` ``, `$`, `<`, `>`, `(`, `)`, `{`, `}`, `\`
	* 2. **Quote characters** — break out of quoted contexts in shell, SQL, URLs: `'`,
	*    `"`
	* 3. **URL/path delimiters** — fragment injection, comment injection: `#`
	* 4. **Whitespace & control characters** — argument splitting, log injection,
	*    terminal escape sequences, null-byte truncation: `0x00`-`0x1f` (all C0
	*    controls including NUL, tab, newline, CR, ESC, etc.) space (`0x20`), DEL
	*    (`0x7f`)
	*/
	function isInjectionCharCode(code) {
		if (code <= 31) return true;
		if (code === 32 || code === 33 || code === 34 || code === 35 || code === 36 || code === 37 || code === 38 || code === 39 || code === 40 || code === 41 || code === 42 || code === 59 || code === 60 || code === 61 || code === 62 || code === 63 || code === 91 || code === 92 || code === 93 || code === 96 || code === 123 || code === 124 || code === 125 || code === 126 || code === 127) return true;
		if (code >= 128 && code <= 159) return true;
		if (code === 8203 || code === 8204 || code === 8205 || code === 8206 || code === 8207 || code === 8234 || code === 8235 || code === 8236 || code === 8237 || code === 8238 || code === 8288 || code === 65279 || code === 65532 || code === 65533) return true;
		return false;
	}
	/**
	* Test whether a character code enables command execution.
	*
	* A narrower scanner than `isInjectionCharCode`, targeting characters that
	* enable shell command execution and code injection. Allows characters that are
	* legitimate in version strings and URL-based qualifier values (like `!`, `+`,
	* `?`, `&`, `=`, `%`, `:`, `/`, `#`, space) while still blocking the most
	* dangerous execution vectors.
	*
	* Used for `version`, `subpath`, and qualifier value validation where the full
	* injection scanner would cause false positives.
	*/
	function isCommandInjectionCharCode(code) {
		if (code <= 31 && code !== 9) return true;
		if (code === 36 || code === 59 || code === 60 || code === 62 || code === 92 || code === 96 || code === 124 || code === 127) return true;
		if (code >= 128 && code <= 159) return true;
		if (code === 8203 || code === 8204 || code === 8205 || code === 8206 || code === 8207 || code === 8234 || code === 8235 || code === 8236 || code === 8237 || code === 8238 || code === 8288 || code === 65279 || code === 65532 || code === 65533) return true;
		return false;
	}
	/**
	* Find the first command injection character in a string. Like
	* `findInjectionCharCode` but uses the narrower command injection set. Returns
	* the character code found, or `-1`.
	*/
	function findCommandInjectionCharCode(str) {
		for (let i = 0, { length } = str; i < length; i += 1) {
			const code = (0, import_string.StringPrototypeCharCodeAt)(str, i);
			if (isCommandInjectionCharCode(code)) return code;
		}
		return -1;
	}
	/**
	* Find the first injection character in a string. Returns the character code of
	* the first dangerous character found, or `-1`.
	*
	* Uses `charCode` scanning for performance in hot paths. The check is a single
	* pass with no allocation, no regex, and no prototype method calls beyond the
	* captured `StringPrototypeCharCodeAt` primordial.
	*
	* Null bytes (`0x00`) are also caught by `validateStrings()` in `validate.ts`,
	* but we include them here for defense-in-depth so callers who skip the base
	* validators still get protection.
	*/
	function findInjectionCharCode(str) {
		for (let i = 0, { length } = str; i < length; i += 1) {
			const code = (0, import_string.StringPrototypeCharCodeAt)(str, i);
			if (isInjectionCharCode(code)) return code;
		}
		return -1;
	}
	/**
	* Narrow injection check: only the characters that enable command/shell
	* injection when a component is interpolated into a shell, plus control
	* characters. Unlike {@link isInjectionCharCode}, this deliberately does NOT
	* flag PURL-spec-legal punctuation (`?`, `#`, `@`, `%`, `!`, `*`, `=`, `[`,
	* `]`, `{`, `}`, `~`, `"`, `'`) so that unregistered PURL types stay
	* spec-compliant while still rejecting genuine RCE payloads like `$(cmd)`,
	* backticks, and pipes. Registered types keep the stricter
	* {@link isInjectionCharCode} denylist via their own validators.
	*/
	function isShellInjectionCharCode(code) {
		if (code <= 31) return true;
		return code === 36 || code === 38 || code === 40 || code === 41 || code === 59 || code === 60 || code === 62 || code === 92 || code === 96 || code === 124 || code === 127;
	}
	/**
	* Scan `str` for the first shell-injection character (see
	* {@link isShellInjectionCharCode}). Returns its char code, or `-1`.
	*/
	function findShellInjectionCharCode(str) {
		for (let i = 0, { length } = str; i < length; i += 1) {
			const code = (0, import_string.StringPrototypeCharCodeAt)(str, i);
			if (isShellInjectionCharCode(code)) return code;
		}
		return -1;
	}
	/**
	* Check if string contains characters commonly used in injection attacks.
	* Returns `true` if any dangerous character is found.
	*
	* For detailed information about which character was found, use
	* {@link findInjectionCharCode} instead.
	*/
	function containsInjectionCharacters(str) {
		return findInjectionCharCode(str) !== -1;
	}
	/**
	* Format an injection character code as a human-readable label for error
	* messages. Returns a string like `"|" (0x7c)` for printable chars or `0x1b`
	* for control chars.
	*/
	function formatInjectionChar(code) {
		const hex = (0, import_number.NumberPrototypeToString)(code, 16);
		if (code >= 32 && code <= 126) return `"${(0, import_string.StringFromCharCode)(code)}" (0x${hex})`;
		return `0x${(0, import_string.StringPrototypePadStart)(hex, 2, "0")}`;
	}
	/**
	* Remove leading slashes from string.
	*/
	function trimLeadingSlashes(str) {
		let start = 0;
		while ((0, import_string.StringPrototypeCharCodeAt)(str, start) === 47) start += 1;
		return start === 0 ? str : (0, import_string.StringPrototypeSlice)(str, start);
	}
	/**
	* @file Normalization functions for PURL components. Handles path
	*   normalization, qualifier processing, and canonical form conversion.
	*/
	const EMPTY_ENTRIES = (0, import_object.ObjectFreeze)([]);
	/**
	* Normalize package name by trimming whitespace.
	*/
	function normalizeName(rawName) {
		return typeof rawName === "string" ? (0, import_string.StringPrototypeTrim)(rawName) : void 0;
	}
	/**
	* Normalize package namespace by trimming and collapsing path separators.
	*/
	function normalizeNamespace(rawNamespace) {
		return typeof rawNamespace === "string" ? normalizePurlPath(rawNamespace) : void 0;
	}
	/**
	* Normalize `purl` path component by collapsing separators and filtering
	* segments.
	*/
	function normalizePurlPath(pathname, options) {
		const { filter: callback } = options ?? {};
		let collapsed = "";
		let start = 0;
		while ((0, import_string.StringPrototypeCharCodeAt)(pathname, start) === 47) start += 1;
		let nextIndex = (0, import_string.StringPrototypeIndexOf)(pathname, "/", start);
		if (nextIndex === -1) {
			const segment = (0, import_string.StringPrototypeSlice)(pathname, start);
			return callback === void 0 || callback(segment) ? segment : "";
		}
		while (nextIndex !== -1) {
			const segment = (0, import_string.StringPrototypeSlice)(pathname, start, nextIndex);
			if (callback === void 0 || callback(segment)) collapsed = collapsed + (collapsed.length === 0 ? "" : "/") + segment;
			start = nextIndex + 1;
			while ((0, import_string.StringPrototypeCharCodeAt)(pathname, start) === 47) start += 1;
			nextIndex = (0, import_string.StringPrototypeIndexOf)(pathname, "/", start);
		}
		const lastSegment = (0, import_string.StringPrototypeSlice)(pathname, start);
		if (lastSegment.length !== 0 && (callback === void 0 || callback(lastSegment))) collapsed = collapsed + (collapsed.length === 0 ? "" : "/") + lastSegment;
		return collapsed;
	}
	/**
	* Normalize qualifiers by trimming values and lowercasing keys.
	*/
	function normalizeQualifiers(rawQualifiers) {
		let qualifiers;
		for (const { 0: key, 1: value } of qualifiersToEntries(rawQualifiers)) {
			if (typeof key !== "string") continue;
			const trimmed = (0, import_string.StringPrototypeTrim)(typeof value === "string" ? value : typeof value === "number" || typeof value === "boolean" ? `${value}` : "");
			if (trimmed.length === 0) continue;
			if (qualifiers === void 0) qualifiers = (0, import_object.ObjectCreate)(null);
			qualifiers[(0, import_string.StringPrototypeToLowerCase)(key)] = trimmed;
		}
		return qualifiers;
	}
	/**
	* Normalize subpath by filtering invalid segments.
	*/
	function normalizeSubpath(rawSubpath) {
		return typeof rawSubpath === "string" ? normalizePurlPath(rawSubpath, { filter: subpathFilter }) : void 0;
	}
	/**
	* Normalize package type to lowercase.
	*/
	function normalizeType(rawType) {
		return typeof rawType === "string" ? (0, import_string.StringPrototypeToLowerCase)((0, import_string.StringPrototypeTrim)(rawType)) : void 0;
	}
	/**
	* Normalize package version by trimming whitespace.
	*/
	function normalizeVersion(rawVersion) {
		return typeof rawVersion === "string" ? (0, import_string.StringPrototypeTrim)(rawVersion) : void 0;
	}
	/**
	* Convert qualifiers to iterable entries.
	*/
	function qualifiersToEntries(rawQualifiers) {
		if (isObject(rawQualifiers)) {
			const rawQualifiersObj = rawQualifiers;
			const entriesProperty = rawQualifiersObj["entries"];
			return typeof entriesProperty === "function" ? (0, import_reflect.ReflectApply)(entriesProperty, rawQualifiersObj, []) : (0, import_object.ObjectEntries)(rawQualifiers);
		}
		return typeof rawQualifiers === "string" ? new import_url.URLSearchParamsCtor(rawQualifiers).entries() : EMPTY_ENTRIES;
	}
	/**
	* Filter invalid subpath segments.
	*/
	function subpathFilter(segment) {
		const { length } = segment;
		if (length === 1 && (0, import_string.StringPrototypeCharCodeAt)(segment, 0) === 46) return false;
		if (length === 2 && (0, import_string.StringPrototypeCharCodeAt)(segment, 0) === 46 && (0, import_string.StringPrototypeCharCodeAt)(segment, 1) === 46) return false;
		return !isBlank(segment);
	}
	var require_json = /* @__PURE__ */ __commonJSMin(((exports$16) => {
		Object.defineProperty(exports$16, Symbol.toStringTag, { value: "Module" });
		/**
		* @file Safe references to `JSON.parse` / `JSON.stringify`. Captured at module
		*   load so prototype-pollution attacks (e.g. monkey-patching `JSON.parse` to
		*   leak the parsed payload) can't redirect callers that route through these
		*   references.
		*/
		const JSONParse = JSON.parse;
		const JSONStringify = JSON.stringify;
		exports$16.JSONParse = JSONParse;
		exports$16.JSONStringify = JSONStringify;
	}));
	/**
	* @file URL encoding functions for PURL components. Provides special handling
	*   for names, namespaces, versions, qualifiers, and subpaths.
	*/
	var import_globals = (/* @__PURE__ */ __commonJSMin(((exports$17) => {
		Object.defineProperty(exports$17, Symbol.toStringTag, { value: "Module" });
		/**
		* @file Safe references to top-level globals that don't fit a larger
		*   primordials leaf — primitive constructors (`Boolean`, `BigInt`), `Proxy`,
		*   `SharedArrayBuffer`, language-level constants (`Infinity`, `NaN`,
		*   `globalThis`), and the encode/decode helpers. Every reference is captured
		*   once at module load so consumers reading adversarial input never see a
		*   tampered global.
		*/
		const BigIntCtor = BigInt;
		const BooleanCtor = Boolean;
		const ProxyCtor = Proxy;
		const SharedArrayBufferCtor = typeof SharedArrayBuffer === "undefined" ? void 0 : SharedArrayBuffer;
		const InfinityValue = Infinity;
		const NaNValue = NaN;
		const capturedGlobalThis = globalThis;
		const atob = globalThis.atob;
		const btoa = globalThis.btoa;
		const decodeURIComponent = globalThis.decodeURIComponent;
		const encodeURIComponent = globalThis.encodeURIComponent;
		exports$17.BigIntCtor = BigIntCtor;
		exports$17.BooleanCtor = BooleanCtor;
		exports$17.InfinityValue = InfinityValue;
		exports$17.NaNValue = NaNValue;
		exports$17.ProxyCtor = ProxyCtor;
		exports$17.SharedArrayBufferCtor = SharedArrayBufferCtor;
		exports$17.atob = atob;
		exports$17.btoa = btoa;
		exports$17.decodeURIComponent = decodeURIComponent;
		exports$17.encodeURIComponent = encodeURIComponent;
		exports$17.globalThis = capturedGlobalThis;
	})))();
	const encodeComponent = import_globals.encodeURIComponent;
	const REUSED_SEARCH_PARAMS = new import_url.URLSearchParamsCtor();
	const REUSED_SEARCH_PARAMS_KEY = "_";
	const REUSED_SEARCH_PARAMS_OFFSET = 2;
	/**
	* Encode package name component for URL.
	*/
	function encodeName(name) {
		return isNonEmptyString(name) ? (0, import_string.StringPrototypeReplaceAll)(encodeComponent(name), "%3A", ":") : "";
	}
	/**
	* Encode package namespace component for URL.
	*/
	function encodeNamespace(namespace) {
		return isNonEmptyString(namespace) ? (0, import_string.StringPrototypeReplaceAll)((0, import_string.StringPrototypeReplaceAll)(encodeComponent(namespace), "%3A", ":"), "%2F", "/") : "";
	}
	/**
	* Encode qualifier parameter key or value.
	*/
	function encodeQualifierParam(param) {
		if (isNonEmptyString(param)) {
			const value = prepareValueForSearchParams(param);
			REUSED_SEARCH_PARAMS.set(REUSED_SEARCH_PARAMS_KEY, value);
			return normalizeSearchParamsEncoding((0, import_string.StringPrototypeSlice)(REUSED_SEARCH_PARAMS.toString(), REUSED_SEARCH_PARAMS_OFFSET));
		}
		return "";
	}
	/**
	* Encode qualifiers object as URL query string.
	*/
	function encodeQualifiers(qualifiers) {
		if (isObject(qualifiers)) {
			const qualifiersKeys = (0, import_array.ArrayPrototypeToSorted)((0, import_object.ObjectKeys)(qualifiers));
			const searchParams = new import_url.URLSearchParamsCtor();
			for (let i = 0, { length } = qualifiersKeys; i < length; i += 1) {
				const key = qualifiersKeys[i];
				const value = prepareValueForSearchParams(qualifiers[key]);
				searchParams.set(key, value);
			}
			return normalizeSearchParamsEncoding(searchParams.toString());
		}
		return "";
	}
	/**
	* Encode subpath component for URL.
	*/
	function encodeSubpath(subpath) {
		return isNonEmptyString(subpath) ? (0, import_string.StringPrototypeReplaceAll)((0, import_string.StringPrototypeReplaceAll)(encodeComponent(subpath), "%2F", "/"), "%3A", ":") : "";
	}
	/**
	* Encode package version component for URL.
	*/
	function encodeVersion(version) {
		return isNonEmptyString(version) ? (0, import_string.StringPrototypeReplaceAll)(encodeComponent(version), "%3A", ":") : "";
	}
	/**
	* Normalize `URLSearchParams` output for qualifier encoding.
	*
	* `URLSearchParams` applies `application/x-www-form-urlencoded` escaping, which
	* is stricter than the purl spec. The spec lists characters that "shall not be
	* percent-encoded" in a qualifier value; of the ones form-encoding wrongly
	* escapes, restore the colon ':' (spec: never encoded, "whether used as a
	* Separator Character or otherwise") and the tilde '~' (an unreserved
	* Punctuation Character). The slash '/' and at sign '@' stay percent-encoded
	* inside a value — they are not in the spec's no-encode set there.
	*/
	function normalizeSearchParamsEncoding(encoded) {
		if ((0, import_string.StringPrototypeIndexOf)(encoded, "%") === -1 && (0, import_string.StringPrototypeIndexOf)(encoded, "+") === -1) return encoded;
		return (0, import_string.StringPrototypeReplaceAll)((0, import_string.StringPrototypeReplaceAll)((0, import_string.StringPrototypeReplaceAll)((0, import_string.StringPrototypeReplaceAll)(encoded, "%2520", "%20"), "+", "%2B"), "%3A", ":"), "%7E", "~");
	}
	/**
	* Prepare string value for `URLSearchParams` encoding.
	*/
	function prepareValueForSearchParams(value) {
		return (0, import_string.StringPrototypeReplaceAll)(String(value), " ", "%20");
	}
	/**
	* @file Helper function for creating namespace objects. Organizes helper
	*   functions by property names with configurable defaults and sorting.
	*/
	/**
	* Create namespace object organizing helpers by property names.
	*/
	function createHelpersNamespaceObject(helpers, options_ = {}) {
		const { comparator, ...defaults } = {
			__proto__: null,
			...options_
		};
		const helperNames = (0, import_array.ArrayPrototypeToSorted)((0, import_object.ObjectKeys)(helpers));
		const propNames = (0, import_array.ArrayPrototypeToSorted)([...new import_map_set.SetCtor((0, import_array.ArrayPrototypeFlatMap)((0, import_object.ObjectValues)(helpers), (helper) => (0, import_object.ObjectKeys)(helper)))], comparator);
		const nsObject = (0, import_object.ObjectCreate)(null);
		for (let i = 0, { length } = propNames; i < length; i += 1) {
			const propName = propNames[i];
			const helpersForProp = (0, import_object.ObjectCreate)(null);
			for (let j = 0, { length: helperNamesLength } = helperNames; j < helperNamesLength; j += 1) {
				const helperName = helperNames[j];
				const helperValue = helpers[helperName]?.[propName] ?? defaults[helperName];
				if (helperValue !== void 0) helpersForProp[helperName] = helperValue;
			}
			nsObject[propName] = helpersForProp;
		}
		return nsObject;
	}
	/**
	* Format error message for PURL exceptions.
	*/
	function formatPurlErrorMessage(message = "") {
		const { length } = message;
		let formatted = "";
		if (length) {
			const code0 = (0, import_string.StringPrototypeCharCodeAt)(message, 0);
			formatted = code0 >= 65 && code0 <= 90 ? `${(0, import_string.StringPrototypeToLowerCase)(message[0])}${(0, import_string.StringPrototypeSlice)(message, 1)}` : message;
			if (length > 1 && (0, import_string.StringPrototypeCharCodeAt)(message, length - 1) === 46 && (0, import_string.StringPrototypeCharCodeAt)(message, length - 2) !== 46) formatted = (0, import_string.StringPrototypeSlice)(formatted, 0, -1);
		}
		return `Invalid purl: ${formatted}`;
	}
	/**
	* Custom error class for Package URL parsing and validation failures.
	*/
	var PurlError = class extends Error {
		constructor(message, options) {
			super(formatPurlErrorMessage(message), options);
		}
	};
	/**
	* Specialized error for injection character detection. Developers can catch
	* this specifically to distinguish injection rejections from other PURL
	* validation errors and handle them at an elevated level (e.g., logging,
	* alerting, blocking).
	*
	* Properties: - `component` — which PURL component was rejected (`"name"`,
	* `"namespace"`) - `charCode` — the character code of the injection character
	* found - `purlType` — the package type (e.g., `"npm"`, `"maven"`)
	*/
	var PurlInjectionError = class extends PurlError {
		charCode;
		component;
		purlType;
		constructor(purlType, component, charCode, charLabel) {
			super(`${purlType} "${component}" component contains injection character ${charLabel}`);
			this.charCode = charCode;
			this.component = component;
			this.purlType = purlType;
			(0, import_object.ObjectFreeze)(this);
		}
	};
	(0, import_object.ObjectFreeze)(PurlInjectionError.prototype);
	/**
	* @file Language utility functions for checking null, undefined, and empty
	*   string values. Provides type checking predicates for common value
	*   validation scenarios.
	*/
	/**
	* Check if a value is `null`, `undefined`, or an empty string.
	*/
	function isNullishOrEmptyString(value) {
		return value === null || value === void 0 || typeof value === "string" && value.length === 0;
	}
	/**
	* @file Primitive validation helpers shared by PURL component validators.
	*   Checks for required presence, string type, null bytes, injection
	*   characters, and leading-digit constraints.
	*/
	/**
	* Validate that component is empty for specific package type.
	*/
	function validateEmptyByType(type, name, value, options) {
		const { throws = false } = options ?? {};
		if (!isNullishOrEmptyString(value)) {
			if (throws) throw new PurlError(`${type} "${name}" component must be empty`);
			return false;
		}
		return true;
	}
	/**
	* Validate that a component does not contain injection characters. Shared
	* helper to eliminate boilerplate across per-type validators.
	*
	* @throws {PurlInjectionError} When validation fails and `throws` is `true`.
	*   The error includes the specific character code, component name, and package
	*   type so callers can log, alert, or handle injection attempts at an elevated
	*   level.
	*/
	function validateNoInjectionByType(type, component, value, options) {
		const { throws = false } = options ?? {};
		if (typeof value === "string") {
			const code = findInjectionCharCode(value);
			if (code !== -1) {
				if (throws) throw new PurlInjectionError(type, component, code, formatInjectionChar(code));
				return false;
			}
		}
		return true;
	}
	/**
	* Validate that component is present and not empty.
	*
	* @throws {PurlError} When validation fails and options.throws is true.
	*/
	function validateRequired(name, value, options) {
		const { throws = false } = options ?? {};
		if (isNullishOrEmptyString(value)) {
			if (throws) throw new PurlError(`"${name}" is a required component`);
			return false;
		}
		return true;
	}
	/**
	* Validate that component is required for specific package type.
	*
	* @throws {PurlError} When validation fails and options.throws is true.
	*/
	function validateRequiredByType(type, name, value, options) {
		const { throws = false } = options ?? {};
		if (isNullishOrEmptyString(value)) {
			if (throws) throw new PurlError(`${type} requires a "${name}" component`);
			return false;
		}
		return true;
	}
	/**
	* Validate that value does not start with a number.
	*
	* @throws {PurlError} When validation fails and options.throws is true.
	*/
	function validateStartsWithoutNumber(name, value, options) {
		const { throws = false } = options ?? {};
		if (isNonEmptyString(value)) {
			const code = (0, import_string.StringPrototypeCharCodeAt)(value, 0);
			if (code >= 48 && code <= 57) {
				if (throws) throw new PurlError(`${name} "${value}" cannot start with a number`);
				return false;
			}
		}
		return true;
	}
	/**
	* Validate that value is a string type.
	*
	* @throws {PurlError} When validation fails and options.throws is true.
	*/
	function validateStrings(name, value, options) {
		const { throws = false } = options ?? {};
		if (value === null || value === void 0) return true;
		if (typeof value !== "string") {
			if (throws) throw new PurlError(`"${name}" must be a string`);
			return false;
		}
		if ((0, import_string.StringPrototypeIncludes)(value, "\0")) {
			if (throws) throw new PurlError(`"${name}" must not contain null bytes`);
			return false;
		}
		return true;
	}
	/**
	* @file Validation functions for PURL components. Ensures compliance with
	*   Package URL specification requirements and constraints.
	*/
	/**
	* Validate package name component.
	*
	* @throws {PurlError} When validation fails and options.throws is true.
	*/
	function validateName(name, options) {
		const opts = options;
		const { throws = false } = opts ?? {};
		if (!validateRequired("name", name, opts) || !validateStrings("name", name, opts)) return false;
		const MAX_NAME_LENGTH = 214;
		if (typeof name === "string" && name.length > MAX_NAME_LENGTH) {
			if (throws) throw new PurlError(`"name" exceeds maximum length of ${MAX_NAME_LENGTH} characters`);
			return false;
		}
		return true;
	}
	/**
	* Validate package namespace component.
	*
	* @throws {PurlError} When validation fails and options.throws is true.
	*/
	function validateNamespace(namespace, options) {
		const opts = options;
		const { throws = false } = opts ?? {};
		if (!validateStrings("namespace", namespace, opts)) return false;
		const MAX_NAMESPACE_LENGTH = 512;
		if (typeof namespace === "string" && namespace.length > MAX_NAMESPACE_LENGTH) {
			if (throws) throw new PurlError(`"namespace" exceeds maximum length of ${MAX_NAMESPACE_LENGTH} characters`);
			return false;
		}
		return true;
	}
	/**
	* Validate qualifier key format and characters.
	*
	* @throws {PurlError} When validation fails and options.throws is true.
	*/
	function validateQualifierKey(key, options) {
		const opts = options;
		const { throws = false } = opts ?? {};
		if (key.length === 0) {
			if (throws) throw new PurlError("qualifier key must not be empty");
			return false;
		}
		const MAX_QUALIFIER_KEY_LENGTH = 256;
		if (key.length > MAX_QUALIFIER_KEY_LENGTH) {
			if (throws) throw new PurlError(`qualifier key exceeds maximum length of ${MAX_QUALIFIER_KEY_LENGTH} characters`);
			return false;
		}
		if (!validateStartsWithoutNumber("qualifier", key, opts)) return false;
		for (let i = 0, { length } = key; i < length; i += 1) {
			const code = (0, import_string.StringPrototypeCharCodeAt)(key, i);
			if (!(code >= 48 && code <= 57 || code >= 65 && code <= 90 || code >= 97 && code <= 122 || code === 46 || code === 45 || code === 95)) {
				if (throws) throw new PurlError(`qualifier key "${key}" must match [a-z0-9.\\-_]`);
				return false;
			}
		}
		return true;
	}
	/**
	* Validate qualifiers object structure and keys.
	*
	* @throws {PurlError} When validation fails and options.throws is true.
	*/
	function validateQualifiers(qualifiers, options) {
		const opts = options;
		const { throws = false } = opts ?? {};
		if (qualifiers === null || qualifiers === void 0) return true;
		if (typeof qualifiers !== "object" || (0, import_array.ArrayIsArray)(qualifiers)) {
			if (throws) throw new PurlError("\"qualifiers\" must be a plain object");
			return false;
		}
		const qualifiersObj = qualifiers;
		const keysProperty = qualifiersObj["keys"];
		const keysIterable = typeof keysProperty === "function" ? (0, import_reflect.ReflectApply)(keysProperty, qualifiersObj, []) : (0, import_object.ObjectKeys)(qualifiers);
		for (const key of keysIterable) {
			if (typeof key !== "string") {
				if (throws) throw new PurlError("qualifier key must be a string");
				return false;
			}
			if (!validateQualifierKey(key, opts)) return false;
			const value = typeof qualifiersObj[key] === "string" ? qualifiersObj[key] : void 0;
			if (value !== void 0) {
				const MAX_QUALIFIER_VALUE_LENGTH = 65536;
				if (value.length > MAX_QUALIFIER_VALUE_LENGTH) {
					if (throws) throw new PurlError(`qualifier "${key}" value exceeds maximum length of ${MAX_QUALIFIER_VALUE_LENGTH} characters`);
					return false;
				}
				const code = findCommandInjectionCharCode(value);
				if (code !== -1) {
					if (throws) throw new PurlInjectionError("purl", `qualifier "${key}"`, code, formatInjectionChar(code));
					return false;
				}
			}
		}
		return true;
	}
	/**
	* Validate subpath component. Rejects command injection characters (`|`, `;`,
	* `` ` ``, `$`, `<`, `>`, `\`) while allowing characters that are legitimate in
	* decoded subpaths (`?`, `#`, space, etc. which get percent-encoded in the PURL
	* string representation).
	*
	* @throws {PurlInjectionError} When command injection characters found and
	*   `options.throws` is `true`.
	* @throws {PurlError} When validation fails and `options.throws` is `true`.
	*/
	function validateSubpath(subpath, options) {
		const opts = options;
		const { throws = false } = opts ?? {};
		if (!validateStrings("subpath", subpath, opts)) return false;
		if (typeof subpath === "string") {
			const code = findCommandInjectionCharCode(subpath);
			if (code !== -1) {
				if (throws) throw new PurlInjectionError("purl", "subpath", code, formatInjectionChar(code));
				return false;
			}
		}
		return true;
	}
	/**
	* Validate package type component format and characters.
	*
	* @throws {PurlError} When validation fails and options.throws is true.
	*/
	function validateType(type, options) {
		const opts = options;
		const { throws = false } = opts ?? {};
		if (!validateRequired("type", type, opts) || !validateStrings("type", type, opts) || !validateStartsWithoutNumber("type", type, opts)) return false;
		for (let i = 0, { length } = type; i < length; i += 1) {
			const code = (0, import_string.StringPrototypeCharCodeAt)(type, i);
			if (!(code >= 48 && code <= 57 || code >= 65 && code <= 90 || code >= 97 && code <= 122 || code === 46 || code === 45)) {
				if (throws) throw new PurlError(`type "${type}" must match [A-Za-z0-9.\\-]`);
				return false;
			}
		}
		return true;
	}
	/**
	* Validate package version component. Rejects command injection characters
	* (`|`, `;`, `` ` ``, `$`, `<`, `>`, `\`) while allowing characters legitimate
	* in version strings (`!`, `+`, `-`, `.`, `_`, `~`, space, `%`, `?`, `#`).
	*
	* @throws {PurlInjectionError} When command injection characters found and
	*   `options.throws` is `true`.
	* @throws {PurlError} When validation fails and `options.throws` is `true`.
	*/
	function validateVersion(version, options) {
		const opts = options;
		const { throws = false } = opts ?? {};
		if (!validateStrings("version", version, opts)) return false;
		const MAX_VERSION_LENGTH = 256;
		if (typeof version === "string" && version.length > MAX_VERSION_LENGTH) {
			if (throws) throw new PurlError(`"version" exceeds maximum length of ${MAX_VERSION_LENGTH} characters`);
			return false;
		}
		if (typeof version === "string") {
			const code = findCommandInjectionCharCode(version);
			if (code !== -1) {
				if (throws) throw new PurlInjectionError("purl", "version", code, formatInjectionChar(code));
				return false;
			}
		}
		return true;
	}
	/**
	* @file PURL component handlers providing encoding, normalization, and
	*   validation functionality. Handles all Package URL components including
	*   `type`, `namespace`, `name`, `version`, `qualifiers`, and `subpath`.
	*/
	const componentSortOrderLookup = {
		__proto__: null,
		name: 2,
		namespace: 1,
		qualifierKey: 5,
		qualifiers: 4,
		qualifierValue: 6,
		subpath: 7,
		type: 0,
		version: 3
	};
	/**
	* Encode PURL component value to string.
	*/
	function PurlComponentEncoder(comp) {
		return isNonEmptyString(comp) ? encodeComponent(comp) : "";
	}
	/**
	* Normalize PURL component to string or undefined.
	*/
	function PurlComponentStringNormalizer(comp) {
		return typeof comp === "string" ? comp : void 0;
	}
	/**
	* Validate PURL component value.
	*/
	function PurlComponentValidator(_comp, _options) {
		return true;
	}
	/**
	* Compare two component names for sorting.
	*/
	function componentComparator(compA, compB) {
		return componentSortOrder(compA) - componentSortOrder(compB);
	}
	/**
	* Get numeric sort order for component name.
	*/
	function componentSortOrder(comp) {
		return componentSortOrderLookup[comp] ?? 8;
	}
	const PurlComponent = createHelpersNamespaceObject({
		encode: {
			name: encodeName,
			namespace: encodeNamespace,
			version: encodeVersion,
			qualifiers: encodeQualifiers,
			qualifierKey: encodeQualifierParam,
			qualifierValue: encodeQualifierParam,
			subpath: encodeSubpath
		},
		normalize: {
			type: normalizeType,
			namespace: normalizeNamespace,
			name: normalizeName,
			version: normalizeVersion,
			qualifiers: normalizeQualifiers,
			subpath: normalizeSubpath
		},
		validate: {
			type: validateType,
			namespace: validateNamespace,
			name: validateName,
			version: validateVersion,
			qualifierKey: validateQualifierKey,
			qualifiers: validateQualifiers,
			subpath: validateSubpath
		}
	}, {
		comparator: componentComparator,
		encode: PurlComponentEncoder,
		normalize: PurlComponentStringNormalizer,
		validate: PurlComponentValidator
	});
	/**
	* @file Constants defining standard PURL qualifier names. Provides
	*   `repository_url`, `download_url`, `vcs_url`, `file_name`, and `checksum`
	*   qualifier constants.
	*/
	const PurlQualifierNames = {
		__proto__: null,
		Checksum: "checksum",
		DownloadUrl: "download_url",
		FileName: "file_name",
		RepositoryUrl: "repository_url",
		VcsUrl: "vcs_url",
		Vers: "vers"
	};
	/**
	* @file ALPM (Arch Linux Package Manager) PURL normalization.
	*   https://github.com/package-url/purl-spec/blob/main/PURL-TYPES.rst#alpm.
	*/
	/**
	* Normalize ALPM package URL. Lowercases both `namespace` and `name`.
	*/
	function normalize$27(purl) {
		lowerNamespace(purl);
		lowerName(purl);
		return purl;
	}
	/**
	* @file APK (Alpine Package Manager) PURL normalization.
	*   https://github.com/package-url/purl-spec/blob/main/PURL-TYPES.rst#apk.
	*/
	/**
	* Normalize APK package URL. Lowercases both `namespace` and `name`.
	*/
	function normalize$26(purl) {
		lowerNamespace(purl);
		lowerName(purl);
		return purl;
	}
	/**
	* @file Bazel-specific PURL validation.
	*   https://github.com/package-url/purl-spec/blob/main/PURL-TYPES.rst Bazel is
	*   a build system. Bazel packages represent external dependencies in Bazel
	*   `BUILD` files. No normalize step: a Bazel module name is case-sensitive and
	*   already lowercase by Bazel's own grammar. Bazel validates module names
	*   against `VALID_MODULE_NAME = [a-z]([a-z0-9._-]*[a-z0-9])?`
	*   (RepositoryName.java in bazelbuild/bazel) and the Bazel Central Registry
	*   stores each module under that exact validated string, so uppercase is
	*   rejected at the source rather than folded — lowercasing here would only
	*   mask an invalid name. This matches the canonical purl-spec roundtrip
	*   fixture `pkg:bazel/Curl@8.8.0.bcr.1`, which preserves the input case. The
	*   purl bazel type definition carries no `case_sensitive` flag and no
	*   normalization rule, consistent with preserve.
	*/
	/**
	* Validate Bazel package URL. Bazel packages must have a `version` (for
	* reproducible builds). `name` must not contain injection characters.
	*/
	function bazelValidate(purl, options) {
		const { throws = false } = options ?? {};
		if (!purl.version || purl.version.length === 0) {
			if (throws) throw new PurlError("bazel requires a \"version\" component");
			return false;
		}
		if (!validateNoInjectionByType("bazel", "name", purl.name, { throws })) return false;
		return true;
	}
	/**
	* @file Bitbucket PURL normalization and validation.
	*   https://github.com/package-url/purl-spec/blob/main/PURL-TYPES.rst#bitbucket.
	*/
	/**
	* Validate Bitbucket package URL. `name` and `namespace` must not contain
	* injection characters.
	*/
	function bitbucketValidate(purl, options) {
		const { throws = false } = options ?? {};
		if (!validateNoInjectionByType("bitbucket", "namespace", purl.namespace, { throws })) return false;
		if (!validateNoInjectionByType("bitbucket", "name", purl.name, { throws })) return false;
		return true;
	}
	/**
	* Normalize Bitbucket package URL. Lowercases both `namespace` and `name`.
	*/
	function normalize$25(purl) {
		lowerNamespace(purl);
		lowerName(purl);
		return purl;
	}
	/**
	* @file Bitnami PURL normalization.
	*   https://github.com/package-url/purl-spec/blob/main/PURL-TYPES.rst#bitnami.
	*/
	/**
	* Normalize Bitnami package URL. Lowercases `name` only.
	*/
	function normalize$24(purl) {
		lowerName(purl);
		return purl;
	}
	var require_math = /* @__PURE__ */ __commonJSMin(((exports$18) => {
		Object.defineProperty(exports$18, Symbol.toStringTag, { value: "Module" });
		/**
		* @file Safe references to `Math` constants and methods. Methods prefer the
		*   smol fast-path (`node:smol-primordial`) when available — V8 Fast API typed
		*   implementations TurboFan inlines into JIT'd callers. Constants stay as the
		*   stock `Math.X` since they are pre-computed scalar values with no fast-path
		*   benefit.
		*/
		const smolPrimordial = require_primordial().getSmolPrimordial();
		const MathE = Math.E;
		const MathLN2 = Math.LN2;
		const MathLN10 = Math.LN10;
		const MathLOG2E = Math.LOG2E;
		const MathLOG10E = Math.LOG10E;
		const MathPI = Math.PI;
		const MathSQRT1_2 = Math.SQRT1_2;
		const MathSQRT2 = Math.SQRT2;
		const MathAbs = smolPrimordial?.mathAbs ?? Math.abs;
		const MathAcos = smolPrimordial?.mathAcos ?? Math.acos;
		const MathAcosh = smolPrimordial?.mathAcosh ?? Math.acosh;
		const MathAsin = smolPrimordial?.mathAsin ?? Math.asin;
		const MathAsinh = smolPrimordial?.mathAsinh ?? Math.asinh;
		const MathAtan = smolPrimordial?.mathAtan ?? Math.atan;
		const MathAtan2 = smolPrimordial?.mathAtan2 ?? Math.atan2;
		const MathAtanh = smolPrimordial?.mathAtanh ?? Math.atanh;
		const MathCbrt = smolPrimordial?.mathCbrt ?? Math.cbrt;
		const MathCeil = smolPrimordial?.mathCeil ?? Math.ceil;
		const MathClz32 = smolPrimordial?.mathClz32 ?? Math.clz32;
		const MathCos = smolPrimordial?.mathCos ?? Math.cos;
		const MathCosh = smolPrimordial?.mathCosh ?? Math.cosh;
		const MathExp = smolPrimordial?.mathExp ?? Math.exp;
		const MathExpm1 = smolPrimordial?.mathExpm1 ?? Math.expm1;
		const MathF16round = Math.f16round;
		const MathFloor = smolPrimordial?.mathFloor ?? Math.floor;
		const MathFround = smolPrimordial?.mathFround ?? Math.fround;
		const MathHypot = smolPrimordial?.mathHypot ?? Math.hypot;
		const MathImul = smolPrimordial?.mathImul ?? Math.imul;
		const MathLog = smolPrimordial?.mathLog ?? Math.log;
		const MathLog1p = smolPrimordial?.mathLog1p ?? Math.log1p;
		const MathLog2 = smolPrimordial?.mathLog2 ?? Math.log2;
		const MathLog10 = smolPrimordial?.mathLog10 ?? Math.log10;
		const MathMax = Math.max;
		const MathMin = Math.min;
		const MathPow = smolPrimordial?.mathPow ?? Math.pow;
		const MathRandom = Math.random;
		const MathRound = smolPrimordial?.mathRound ?? Math.round;
		const MathSign = smolPrimordial?.mathSign ?? Math.sign;
		const MathSin = smolPrimordial?.mathSin ?? Math.sin;
		const MathSinh = smolPrimordial?.mathSinh ?? Math.sinh;
		const MathSqrt = smolPrimordial?.mathSqrt ?? Math.sqrt;
		const MathTan = smolPrimordial?.mathTan ?? Math.tan;
		const MathTanh = smolPrimordial?.mathTanh ?? Math.tanh;
		const MathTrunc = smolPrimordial?.mathTrunc ?? Math.trunc;
		exports$18.MathAbs = MathAbs;
		exports$18.MathAcos = MathAcos;
		exports$18.MathAcosh = MathAcosh;
		exports$18.MathAsin = MathAsin;
		exports$18.MathAsinh = MathAsinh;
		exports$18.MathAtan = MathAtan;
		exports$18.MathAtan2 = MathAtan2;
		exports$18.MathAtanh = MathAtanh;
		exports$18.MathCbrt = MathCbrt;
		exports$18.MathCeil = MathCeil;
		exports$18.MathClz32 = MathClz32;
		exports$18.MathCos = MathCos;
		exports$18.MathCosh = MathCosh;
		exports$18.MathE = MathE;
		exports$18.MathExp = MathExp;
		exports$18.MathExpm1 = MathExpm1;
		exports$18.MathF16round = MathF16round;
		exports$18.MathFloor = MathFloor;
		exports$18.MathFround = MathFround;
		exports$18.MathHypot = MathHypot;
		exports$18.MathImul = MathImul;
		exports$18.MathLN10 = MathLN10;
		exports$18.MathLN2 = MathLN2;
		exports$18.MathLOG10E = MathLOG10E;
		exports$18.MathLOG2E = MathLOG2E;
		exports$18.MathLog = MathLog;
		exports$18.MathLog10 = MathLog10;
		exports$18.MathLog1p = MathLog1p;
		exports$18.MathLog2 = MathLog2;
		exports$18.MathMax = MathMax;
		exports$18.MathMin = MathMin;
		exports$18.MathPI = MathPI;
		exports$18.MathPow = MathPow;
		exports$18.MathRandom = MathRandom;
		exports$18.MathRound = MathRound;
		exports$18.MathSQRT1_2 = MathSQRT1_2;
		exports$18.MathSQRT2 = MathSQRT2;
		exports$18.MathSign = MathSign;
		exports$18.MathSin = MathSin;
		exports$18.MathSinh = MathSinh;
		exports$18.MathSqrt = MathSqrt;
		exports$18.MathTan = MathTan;
		exports$18.MathTanh = MathTanh;
		exports$18.MathTrunc = MathTrunc;
	}));
	var require_buffer = /* @__PURE__ */ __commonJSMin(((exports$19) => {
		Object.defineProperty(exports$19, Symbol.toStringTag, { value: "Module" });
		const require_primordials_uncurry = require_uncurry();
		/**
		* @file Safe references to Node's `Buffer` global. `Buffer` is a Node-only
		*   global; in browsers and in Deno without a compatibility shim the captured
		*   references are `undefined`. Cross- env consumers must null-check before
		*   calling.
		*/
		const BufferCtor = globalThis.Buffer;
		const BufferAlloc = BufferCtor?.alloc;
		const BufferAllocUnsafe = BufferCtor?.allocUnsafe;
		const BufferAllocUnsafeSlow = BufferCtor?.allocUnsafeSlow;
		const BufferByteLength = BufferCtor?.byteLength;
		const BufferConcat = BufferCtor?.concat;
		const BufferFrom = BufferCtor?.from;
		const BufferIsBuffer = BufferCtor?.isBuffer;
		const BufferIsEncoding = BufferCtor?.isEncoding;
		/* c8 ignore start */
		const BufferPrototypeSlice = BufferCtor ? require_primordials_uncurry.uncurryThis(BufferCtor.prototype.slice) : void 0;
		const BufferPrototypeToString = BufferCtor ? require_primordials_uncurry.uncurryThis(BufferCtor.prototype.toString) : void 0;
		/* c8 ignore stop */
		exports$19.BufferAlloc = BufferAlloc;
		exports$19.BufferAllocUnsafe = BufferAllocUnsafe;
		exports$19.BufferAllocUnsafeSlow = BufferAllocUnsafeSlow;
		exports$19.BufferByteLength = BufferByteLength;
		exports$19.BufferConcat = BufferConcat;
		exports$19.BufferCtor = BufferCtor;
		exports$19.BufferFrom = BufferFrom;
		exports$19.BufferIsBuffer = BufferIsBuffer;
		exports$19.BufferIsEncoding = BufferIsEncoding;
		exports$19.BufferPrototypeSlice = BufferPrototypeSlice;
		exports$19.BufferPrototypeToString = BufferPrototypeToString;
	}));
	/**
	* Validate Cargo package URL. Cargo packages must not have a `namespace`.
	* `name` must not contain injection characters.
	*/
	function cargoValidate(purl, options) {
		const { throws = false } = options ?? {};
		if (!validateEmptyByType("cargo", "namespace", purl.namespace, { throws })) return false;
		if (!validateNoInjectionByType("cargo", "name", purl.name, { throws })) return false;
		return true;
	}
	/**
	* @file Chrome extension PURL normalization and validation.
	*   https://github.com/package-url/purl-spec/blob/main/types/chrome-extension-definition.json
	*   The name is a Chrome Web Store extension id: exactly 32 characters a-p
	*   rendered a-z in the spec's permitted pattern, case-insensitive (so
	*   normalize lowercases it). The version is semver-like with 1-4 numeric
	*   segments. A namespace is prohibited.
	*/
	const CHROME_EXTENSION_ID_PATTERN = /^[a-z]{32}$/;
	const CHROME_EXTENSION_VERSION_PATTERN = /^\d+(?:\.\d+){0,3}$/;
	/**
	* Validate chrome-extension package URL. Chrome extensions must not have a
	* `namespace`; `name` must be a 32-char a-z extension id; `version`, when
	* present, must be 1-4 dot-separated numeric segments.
	*/
	function chromeExtensionValidate(purl, options) {
		const { throws = false } = options ?? {};
		if (!validateEmptyByType("chrome-extension", "namespace", purl.namespace, { throws })) return false;
		if (!CHROME_EXTENSION_ID_PATTERN.test(purl.name)) {
			if (throws) throw new PurlError("chrome-extension \"name\" component must be a 32-character a-z extension id");
			return false;
		}
		if (purl.version !== void 0 && !CHROME_EXTENSION_VERSION_PATTERN.test(purl.version)) {
			if (throws) throw new PurlError("chrome-extension \"version\" component must be 1-4 dot-separated numeric segments");
			return false;
		}
		return true;
	}
	/**
	* Normalize chrome-extension package URL. Lowercases `name` — the extension id
	* is case-insensitive per spec.
	*/
	function normalize$23(purl) {
		lowerName(purl);
		return purl;
	}
	/**
	* Validate CocoaPods package URL. `name` cannot contain injection or whitespace
	* characters, plus (`+`) character, or begin with a period (`.`).
	*/
	function cocoaodsValidate(purl, options) {
		const { throws = false } = options ?? {};
		const { name } = purl;
		if (!validateNoInjectionByType("cocoapods", "name", name, { throws })) return false;
		if ((0, import_string.StringPrototypeIncludes)(name, "+")) {
			if (throws) throw new PurlError("cocoapods \"name\" component cannot contain a plus (+) character");
			return false;
		}
		if ((0, import_string.StringPrototypeCharCodeAt)(name, 0) === 46) {
			if (throws) throw new PurlError("cocoapods \"name\" component cannot begin with a period");
			return false;
		}
		return true;
	}
	/**
	* Normalize Composer package URL. Lowercases both `namespace` and `name`.
	*/
	function normalize$22(purl) {
		lowerNamespace(purl);
		lowerName(purl);
		return purl;
	}
	/**
	* @file Conan (C/C++) PURL validation.
	*   https://github.com/package-url/purl-spec/blob/main/PURL-TYPES.rst#conan.
	*/
	/**
	* Validate Conan package URL. If `namespace` is present, `qualifiers` are
	* required. If `channel` qualifier is present, `namespace` is required.
	*/
	function conanValidate(purl, options) {
		const { throws = false } = options ?? {};
		if (isNullishOrEmptyString(purl.namespace)) {
			if (purl.qualifiers?.["channel"]) {
				if (throws) throw new PurlError("conan requires a \"namespace\" component when a \"channel\" qualifier is present");
				return false;
			}
		} else if (isNullishOrEmptyString(purl.qualifiers)) {
			if (throws) throw new PurlError("conan requires a \"qualifiers\" component when a namespace is present");
			return false;
		}
		if (!validateNoInjectionByType("conan", "namespace", purl.namespace, { throws })) return false;
		if (!validateNoInjectionByType("conan", "name", purl.name, { throws })) return false;
		return true;
	}
	/**
	* Validate Conda package URL. Conda packages must not have a `namespace`.
	* `name` must not contain injection characters.
	*/
	function condaValidate(purl, options) {
		const { throws = false } = options ?? {};
		if (!validateEmptyByType("conda", "namespace", purl.namespace, { throws })) return false;
		if (!validateNoInjectionByType("conda", "name", purl.name, { throws })) return false;
		return true;
	}
	/**
	* Normalize Conda package URL. Lowercases `name` only.
	*/
	function normalize$21(purl) {
		lowerName(purl);
		return purl;
	}
	/**
	* Validate CPAN package URL. CPAN `namespace` (author/publisher ID) is
	* required and must be uppercase; `name` is a distribution name and must not
	* contain the module-style `::` separator.
	*/
	function cpanValidate(purl, options) {
		const { throws = false } = options ?? {};
		const { namespace } = purl;
		if (!validateRequiredByType("cpan", "namespace", namespace, { throws })) return false;
		if (namespace && namespace !== (0, import_string.StringPrototypeToUpperCase)(namespace)) {
			if (throws) throw new PurlError("cpan \"namespace\" component must be UPPERCASE");
			return false;
		}
		if ((0, import_string.StringPrototypeIncludes)(purl.name, "::")) {
			if (throws) throw new PurlError("cpan \"name\" component is a distribution name and must not contain \"::\"");
			return false;
		}
		if (!validateNoInjectionByType("cpan", "namespace", namespace, { throws })) return false;
		if (!validateNoInjectionByType("cpan", "name", purl.name, { throws })) return false;
		return true;
	}
	/**
	* Validate CRAN package URL. CRAN packages require a `version`. `name` must not
	* contain injection characters.
	*/
	function cranValidate(purl, options) {
		const { throws = false } = options ?? {};
		if (!validateRequiredByType("cran", "version", purl.version, { throws })) return false;
		if (!validateNoInjectionByType("cran", "name", purl.name, { throws })) return false;
		return true;
	}
	/**
	* @file Debian package PURL normalization.
	*   https://github.com/package-url/purl-spec/blob/main/PURL-TYPES.rst#deb.
	*/
	/**
	* Normalize Debian package URL. Lowercases both `namespace` and `name`.
	*/
	function normalize$20(purl) {
		lowerNamespace(purl);
		lowerName(purl);
		return purl;
	}
	/**
	* Validate Docker package URL. `name` and `namespace` must not contain
	* injection characters.
	*/
	function dockerValidate(purl, options) {
		const { throws = false } = options ?? {};
		if (!validateNoInjectionByType("docker", "namespace", purl.namespace, { throws })) return false;
		if (!validateNoInjectionByType("docker", "name", purl.name, { throws })) return false;
		return true;
	}
	/**
	* Normalize Docker package URL. Lowercases `namespace` (user/org) and `name`.
	* The distribution/reference grammar makes every path-component (the user/org
	* namespace segment and the image name) lowercase-only — `docker pull` rejects
	* uppercase — and a registry host belongs in `repository_url`, never the
	* namespace, so folding the namespace is never lossy. The version (a tag or
	* sha256 id) is preserved.
	*/
	function normalize$19(purl) {
		lowerNamespace(purl);
		lowerName(purl);
		return purl;
	}
	/**
	* Validate RubyGem package URL. Gem packages must not have a `namespace`.
	* `name` must not contain injection characters.
	*/
	function gemValidate(purl, options) {
		const { throws = false } = options ?? {};
		if (!validateEmptyByType("gem", "namespace", purl.namespace, { throws })) return false;
		if (!validateNoInjectionByType("gem", "name", purl.name, { throws })) return false;
		return true;
	}
	/**
	* Normalize generic package URL. No type-specific normalization for generic
	* packages.
	*/
	function normalize$18(purl) {
		return purl;
	}
	/**
	* @file GitHub PURL normalization and validation.
	*   https://github.com/package-url/purl-spec/blob/main/PURL-TYPES.rst#github.
	*/
	/**
	* Validate GitHub package URL. `name` and `namespace` must not contain
	* injection characters.
	*/
	function githubValidate(purl, options) {
		const { throws = false } = options ?? {};
		if (!validateNoInjectionByType("github", "namespace", purl.namespace, { throws })) return false;
		if (!validateNoInjectionByType("github", "name", purl.name, { throws })) return false;
		return true;
	}
	/**
	* Normalize GitHub package URL. Lowercases both `namespace` and `name`.
	*/
	function normalize$17(purl) {
		lowerNamespace(purl);
		lowerName(purl);
		return purl;
	}
	/**
	* @file GitLab PURL normalization and validation.
	*   https://github.com/package-url/purl-spec/blob/main/PURL-TYPES.rst#other-candidate-types-to-define.
	*/
	/**
	* Validate GitLab package URL. `name` and `namespace` must not contain
	* injection characters.
	*/
	function gitlabValidate(purl, options) {
		const { throws = false } = options ?? {};
		if (!validateNoInjectionByType("gitlab", "namespace", purl.namespace, { throws })) return false;
		if (!validateNoInjectionByType("gitlab", "name", purl.name, { throws })) return false;
		return true;
	}
	/**
	* Normalize GitLab package URL. Lowercases both `namespace` and `name`.
	*/
	function normalize$16(purl) {
		lowerNamespace(purl);
		lowerName(purl);
		return purl;
	}
	/**
	* Decode a Go module proxy escaped path or version back to its real case.
	*
	* The proxy protocol escapes uppercase letters as `!` then lowercase; a literal
	* `!` is reserved as the escape character and may not otherwise appear, so the
	* `!`-then-lowercase pairing is unambiguous:
	*
	* - `github.com/!data!dog/datadog-go` -> `github.com/DataDog/datadog-go`
	* - `v1.0.0-!r!c1` -> `v1.0.0-RC1`
	*
	* The "no literal `!`" guarantee is by design in the Go toolchain
	* (`golang.org/x/mod/module`, `unescapeString`): "Import paths have never
	* allowed exclamation marks, so there is no need to define how to escape a
	* literal `!`." Inverse of {@link encodeGolangProxyPath} (which carries the
	* full protocol provenance).
	*
	* @see https://go.dev/ref/mod#goproxy-protocol
	* @see https://github.com/golang/mod/blob/v0.36.0/module/module.go#L763 (unescapeString)
	*/
	function decodeGolangProxyPath(path) {
		return (0, import_string.StringPrototypeReplace)(path, /!([a-z])/g, (_match, letter) => (0, import_string.StringPrototypeToUpperCase)(String(letter)));
	}
	/**
	* Encode a Go module path or version for the Go module proxy protocol.
	*
	* The proxy escapes every uppercase letter as `!` + its lowercase form so that
	* case-insensitive filesystems and URLs cannot collide case-distinct modules:
	*
	* - `github.com/DataDog/datadog-go` -> `github.com/!data!dog/datadog-go`
	* - `v1.0.0-RC1` -> `v1.0.0-!r!c1`
	*
	* This is a transport detail of `proxy.golang.org`, not part of the canonical
	* PURL string. Inverse of {@link decodeGolangProxyPath}.
	*
	* ## Provenance — this is official Go, not Artifactory-specific
	*
	* Defined in the official Go module proxy protocol (Go Modules Reference,
	* "Module proxies", and `go help goproxy`), which states that to avoid
	* ambiguity when serving from case-insensitive file systems, the $module and
	* $version elements are case-encoded by replacing every uppercase letter with
	* an exclamation mark followed by the corresponding lower-case letter.
	*
	* Implemented in the Go toolchain itself — `golang.org/x/mod/module`, function
	* `escapeString` (called by `EscapePath` / `EscapeVersion`). Rationale,
	* verbatim: "we cannot rely on the file system to keep rsc.io/QUOTE and
	* rsc.io/quote separate. Windows and macOS don't… The safe escaped form is to
	* replace every uppercase letter with an exclamation mark followed by the
	* letter's lowercase equivalent."
	*
	* All conformant proxies (proxy.golang.org, Athens, Nexus, Artifactory) must
	* implement it; the Go client emits these `!`-encoded URLs regardless of which
	* proxy it talks to. Artifactory merely conforms (and historically had a bug
	* failing to: a Go maintainer on golang/go#34084 told an Artifactory user "This
	* is correct as documented in `go help goproxy`… Please file a bug against
	* Artifactory" -> JFrog ticket RTFACT-20227).
	*
	* Ecosystem note: among the purl libraries, only `packageurl-python` ships this
	* escape (`contrib/purl2url.py` `escape_golang_path`, the same purl->URL role
	* as our url-converter), and it cites the same Go proxy protocol. packageurl-go
	* / java / php / ruby / upstream-js do NOT implement it — purl->proxy-URL is an
	* optional convenience, not core purl parsing, so most libraries skip it.
	*
	* @see https://go.dev/ref/mod#goproxy-protocol
	* @see https://github.com/golang/mod/blob/v0.36.0/module/module.go#L707 (escapeString)
	* @see https://github.com/golang/go/issues/34084
	*/
	function encodeGolangProxyPath(path) {
		return (0, import_string.StringPrototypeReplace)(path, /[A-Z]/g, (letter) => `!${(0, import_string.StringPrototypeToLowerCase)(letter)}`);
	}
	/**
	* Validate Golang package URL. `name` and `namespace` must not contain
	* injection characters. If `version` starts with `"v"`, it must be followed by
	* a valid semver version.
	*/
	function golangValidate(purl, options) {
		const { throws = false } = options ?? {};
		if (!validateNoInjectionByType("golang", "namespace", purl.namespace, { throws })) return false;
		if (!validateNoInjectionByType("golang", "name", purl.name, { throws })) return false;
		const { version } = purl;
		if ((typeof version === "string" ? version.length : 0) && (0, import_string.StringPrototypeCharCodeAt)(version, 0) === 118 && !isSemverString((0, import_string.StringPrototypeSlice)(version, 1))) {
			if (throws) throw new PurlError("golang \"version\" component starting with a \"v\" must be followed by a valid semver version");
			return false;
		}
		return true;
	}
	/**
	* Validate Hackage package URL. Hackage packages must not have a `namespace`
	* because the spec prohibits it, and `name` must not contain injection
	* characters. The name stays case-sensitive kebab-case per spec, so there is
	* no normalize step.
	*/
	function hackageValidate(purl, options) {
		const { throws = false } = options ?? {};
		if (!validateEmptyByType("hackage", "namespace", purl.namespace, { throws })) return false;
		if (!validateNoInjectionByType("hackage", "name", purl.name, { throws })) return false;
		return true;
	}
	/**
	* Validate Hex package URL. `name` and `namespace` must not contain injection
	* characters.
	*/
	function hexValidate(purl, options) {
		const { throws = false } = options ?? {};
		if (!validateNoInjectionByType("hex", "namespace", purl.namespace, { throws })) return false;
		if (!validateNoInjectionByType("hex", "name", purl.name, { throws })) return false;
		return true;
	}
	/**
	* Normalize Hex package URL. Lowercases both `namespace` and `name`.
	*/
	function normalize$15(purl) {
		lowerNamespace(purl);
		lowerName(purl);
		return purl;
	}
	/**
	* @file Hugging Face PURL normalization.
	*   https://github.com/package-url/purl-spec/blob/main/PURL-TYPES.rst#huggingface.
	*/
	/**
	* Normalize Hugging Face package URL. Lowercases `version` only.
	*/
	function normalize$14(purl) {
		lowerVersion(purl);
		return purl;
	}
	/**
	* @file Julia-specific PURL normalization and validation.
	*   https://github.com/package-url/purl-spec/blob/main/PURL-TYPES.rst Julia
	*   packages are distributed through the Julia General registry. Package names
	*   are case-sensitive and typically CamelCase.
	*/
	/**
	* Validate Julia package URL. Julia packages must not have a `namespace` and
	* must carry the required `uuid` qualifier (package names are not unique
	* across Julia registries; the UUID is the identity).
	*/
	function juliaValidate(purl, options) {
		const { throws = false } = options ?? {};
		if (!validateEmptyByType("julia", "namespace", purl.namespace, { throws })) return false;
		if (!purl.qualifiers?.["uuid"]) {
			if (throws) throw new PurlError("julia requires a \"uuid\" qualifier");
			return false;
		}
		if (!validateNoInjectionByType("julia", "name", purl.name, { throws })) return false;
		return true;
	}
	/**
	* Normalize Julia package URL. No normalization - Julia package names are
	* case-sensitive.
	*/
	function normalize$13(purl) {
		return purl;
	}
	/**
	* @file LuaRocks PURL normalization.
	*   https://github.com/package-url/purl-spec/blob/main/PURL-TYPES.rst#luarocks.
	*   Per the luarocks type definition, the namespace (author) and name (rock)
	*   are `case_sensitive: false` and normalized to ASCII lowercase — the
	*   luarocks client lowercases both (`name:lower()` / `namespace:lower()` in
	*   src/luarocks/util.lua) and rock/rockspec filenames are all-lowercase. The
	*   version is `case_sensitive: true`: the client never lowercases it and
	*   versions like `scm-1` / `cvs-1` are distinct identifiers ("lowercase must
	*   be used" is publisher guidance for old-client compatibility, not a
	*   canonicalizer fold), so it is preserved.
	*/
	/**
	* Normalize LuaRocks package URL. Lowercases `namespace` (author) and `name`
	* (rock); preserves the case-sensitive `version`.
	*/
	function normalize$12(purl) {
		lowerNamespace(purl);
		lowerName(purl);
		return purl;
	}
	/**
	* Validate Maven package URL. Maven packages require a `namespace` (`groupId`).
	* `name` and `namespace` must not contain injection characters.
	*/
	function mavenValidate(purl, options) {
		const { throws = false } = options ?? {};
		if (!validateRequiredByType("maven", "namespace", purl.namespace, { throws })) return false;
		if (!validateNoInjectionByType("maven", "namespace", purl.namespace, { throws })) return false;
		if (typeof purl.namespace === "string" && (0, import_string.StringPrototypeIncludes)(purl.namespace, "/")) {
			if (throws) throw new PurlError("maven \"namespace\" component must not contain a slash");
			return false;
		}
		if (!validateNoInjectionByType("maven", "name", purl.name, { throws })) return false;
		return true;
	}
	/**
	* @file MLflow PURL normalization and validation.
	*   https://github.com/package-url/purl-spec/blob/main/PURL-TYPES.rst#mlflow.
	*/
	/**
	* Validate MLflow package URL. MLflow packages must not have a `namespace`.
	*/
	function mlflowValidate(purl, options) {
		const { throws = false } = options ?? {};
		if (!validateEmptyByType("mlflow", "namespace", purl.namespace, { throws })) return false;
		if (!validateNoInjectionByType("mlflow", "name", purl.name, { throws })) return false;
		return true;
	}
	/**
	* Normalize MLflow package URL. Lowercases `name` only if `repository_url`
	* qualifier contains `'databricks'`.
	*/
	function normalize$11(purl) {
		const repoUrl = purl.qualifiers?.["repository_url"];
		if (repoUrl !== void 0 && (0, import_string.StringPrototypeIncludes)(repoUrl, "databricks")) lowerName(purl);
		return purl;
	}
	var require_legacy_names = /* @__PURE__ */ __commonJSMin(((exports$20, module$2) => {
		module$2.exports = [
			"@antoinerey/comp-Fetch",
			"@antoinerey/comp-VideoPlayer",
			"@beisen/Accordion",
			"@beisen/Approve",
			"@beisen/AreaSelector",
			"@beisen/AutoComplete",
			"@beisen/AutoTree",
			"@beisen/BaseButton",
			"@beisen/Beaute",
			"@beisen/BeisenCloudMobile",
			"@beisen/BeisenCloudUI",
			"@beisen/ButtonGroup",
			"@beisen/ChaosUI",
			"@beisen/ChaosUI-V1",
			"@beisen/CheckboxList",
			"@beisen/CommonMount",
			"@beisen/CommonPop",
			"@beisen/DataGrid",
			"@beisen/DateTime",
			"@beisen/DropDownButton",
			"@beisen/DropDownList",
			"@beisen/ExtendComponent",
			"@beisen/FormUploader",
			"@beisen/IconButton",
			"@beisen/Loading",
			"@beisen/MultiSelect",
			"@beisen/NaDeStyle",
			"@beisen/Paging",
			"@beisen/PopLayer",
			"@beisen/RadioList",
			"@beisen/ReactTransformTenchmark",
			"@beisen/Search",
			"@beisen/selectedComponent",
			"@beisen/Sidebar",
			"@beisen/StaticFormLabel",
			"@beisen/TabComponent",
			"@beisen/Textarea",
			"@beisen/Textbox",
			"@beisen/TimePicker",
			"@beisen/TitaFeed",
			"@beisen/ToolTip",
			"@beisen/Transfer",
			"@beisen/Tree",
			"@beisen/UserSelector",
			"@chasidic/tsSchema",
			"@chymz/DaStrap",
			"@chymz/DaUsers",
			"@claviska/jquery-ajaxSubmit",
			"@cryptolize/FileSaver",
			"@djforth/I18n_helper",
			"@dostolu/baseController",
			"@dostolu/exctractIntl",
			"@dostolu/mongooseSlug",
			"@dostolu/validationTransformer",
			"@opam-alpha/ANSITerminal",
			"@opam-alpha/BetterErrors",
			"@opam-alpha/reactiveData",
			"@pioug/MidiConvert",
			"@smuuf/idleCat",
			"@sycoraxya/validateJS",
			"@tempest/endWhen",
			"@tempest/fromPromise",
			"@tempest/replaceError",
			"@tempest/startWith",
			"@tempest/throwError",
			"@yuanhao/draft-js-mentionHashtag-plugin",
			"3dBinPack",
			"3DViewerComponent",
			"4meFirst-github-example",
			"9Wares-js",
			"37FIS",
			"A",
			"ABAValidator",
			"ABCEnd",
			"AbokyBot",
			"Accessor",
			"Accessor_MongoDB",
			"Accessor_MySQL",
			"Accessor_Singleton",
			"Account",
			"accumulateArray",
			"ACCUPLACERClient",
			"AccuplacerClient",
			"Acid",
			"activaDocs",
			"ActiveResource.js",
			"ADBCordovaAnalytics",
			"addTimeout",
			"AdultJS",
			"AesUtil",
			"AgentX",
			"AirBridgePlugin",
			"airLogger",
			"ajiThird",
			"alaGDK",
			"AlarmClock",
			"alarmClock",
			"Alchemyst",
			"AlertLogic",
			"alertsXYZ",
			"ali-topSdk",
			"AliceBot",
			"alinkRNTest",
			"aliOcrIdCard",
			"AllCal.WebApp",
			"alpacaDash",
			"AmateurJS",
			"AMD",
			"AMGCryptLib",
			"AmILate",
			"AmILateAnand",
			"amitTest",
			"AmpCoreApi",
			"amProductsearch",
			"amqpWrapper",
			"amrToMp3",
			"angular-autoFields-bootstrap",
			"angular-dateParser",
			"angular-GAPI",
			"angular-PubSub",
			"Angular-test-child",
			"Angular1",
			"Angular2",
			"angular2-Library",
			"angular2-localStorage",
			"angular2-Menu",
			"angular2-quickstart-ngSemantic",
			"angularApp",
			"angularCubicColorPicker",
			"angularjs-ES6-brunch-seed",
			"angularjsSlider",
			"AngularStompDK",
			"Animated_GIF",
			"animateJs",
			"animateSCSS",
			"AnimationFrame",
			"AnimIt",
			"Anirudhnodeapp",
			"Anjali",
			"annoteJS",
			"ANSIdom",
			"antFB",
			"antFB-init",
			"antFB-mobile",
			"antFB-router-redux-ie8",
			"AntMobileUI",
			"AnToast",
			"Antony",
			"aoIoHw90B5sE1wG9",
			"API-Documentation",
			"APIConnect",
			"APICreatorSDK",
			"APlan",
			"APM-mouse",
			"APM.P2H",
			"apMigStats",
			"AporaPushNotification",
			"App2App",
			"applqpakTest",
			"AppTracker",
			"AQ",
			"ArcusNode",
			"AriesNode",
			"array_handler_liz_Li",
			"Array.prototype.forEachAsync",
			"ArrayBuffer-shim",
			"arrayFuncs",
			"ArrowAulaExpress",
			"Article-collider-packages",
			"Arunkumar-Angular-Trial",
			"asEvented",
			"asJam",
			"ASP.NET",
			"assert",
			"AssetPipeline",
			"assignment2-BW",
			"Assignment6",
			"async_hooks",
			"asyncBuilder",
			"asyncEJS",
			"AsyncHttpRequest-CordovaPlugin",
			"AsyncProxy",
			"AsyncStorage",
			"asyncStorage",
			"atom-C",
			"atom-Fe",
			"atom-Ge",
			"atom-K",
			"atom-Li",
			"atom-Na",
			"atom-Pb",
			"atom-Rb",
			"atom-Si",
			"atom-Sn",
			"AulaExpress",
			"austin-vertebraeTest",
			"authorStats",
			"AutoFixture",
			"autoLoader",
			"AutoReact",
			"AutoTasks",
			"Autowebpcss",
			"Avifors",
			"AVNjs",
			"AwesomeProject",
			"AWSS3Drive",
			"ax-rmdirRecursive",
			"b_Tap",
			"Babel",
			"babel-preset-reactTeam",
			"Bablic_Seo_SDK",
			"BablicLogger",
			"Backbone-Collection-Predefined-Filters",
			"Backbone.Aggregator",
			"backbone.browserStorage",
			"Backbone.Chosen",
			"Backbone.Marionette.Handlebars",
			"Backbone.Mutators",
			"Backbone.Overview",
			"Backbone.Rpc",
			"Backbone.Subset",
			"baDataModel",
			"Bag",
			"BaiduMapManager",
			"BandGravity",
			"bangDM",
			"banking-Josh-demo",
			"BankWebservice",
			"bannerFlip",
			"BaremetricsCalendar",
			"Barfer",
			"BarneyRubble",
			"Base",
			"Base64",
			"baseProject",
			"Basic-Material-framework",
			"BasicCredentials",
			"basicFFmpeg",
			"bbArray",
			"Beegee",
			"begineer_Practice",
			"beijingDate",
			"bem-countMaster",
			"bem-countSlave",
			"bem-getHistory",
			"Bestpack",
			"betterMatch",
			"BetterRegExp",
			"Bhellyer",
			"BHP_MSD",
			"BiDirectionalScrollingTable",
			"BigAssFansAPI",
			"BigInt",
			"BIMserverWrapper",
			"Binary-search-tree",
			"binarySearch",
			"bindAll",
			"BinHeap",
			"biojs-vis-RDFSchema",
			"Biolac",
			"Birbal",
			"BitSetModule",
			"BizzStream",
			"Blackfeather",
			"BlackMirror",
			"Blacksmith",
			"blacktea.jsonTemplates",
			"Blaggie-System",
			"BlankUp",
			"Blink1Control2",
			"blitzLib",
			"Blob",
			"BlobBuilder",
			"BlobBuilder-browser",
			"Blog",
			"BlueOcean",
			"BlueOps",
			"Blueprint-Sugar",
			"bluthLBC",
			"blya!",
			"BMFE_scaffold",
			"Bmodule",
			"Bo-colors-project",
			"Boilerpipe-Scraper",
			"Bondlib",
			"bonTemplate",
			"BootSideMenu",
			"bornCordova",
			"Botcord",
			"Bottr-cli",
			"Brackets",
			"brain***_games***",
			"Brave",
			"BrewCore",
			"BrianPingPong",
			"BrianSuperComponents",
			"BrickPlus",
			"Brocket",
			"Brosec",
			"browserProxy",
			"browserType",
			"brush-Makefile",
			"bTap",
			"BtMacAddress",
			"BubbleJS",
			"Buffer",
			"buffer",
			"BufferList",
			"Bugay",
			"Build",
			"BuildBox",
			"Builder",
			"Builders",
			"BuildWithJavascript",
			"BusinessObjects",
			"Button",
			"Buttons",
			"Bynd",
			"ByteBuffer",
			"C9js",
			"Cache-Service-Collector",
			"Cacher",
			"callbackQueue",
			"CallbackRouter",
			"callBlock-plugin",
			"callBlock.plugin",
			"camcardPlugin",
			"CameraPreview",
			"Canteen",
			"canvas-toBlob",
			"canvasColorPicker",
			"Caoutchouc",
			"Cap",
			"Carbon",
			"cardsJS",
			"Cartogram-Utils",
			"cascadeDrop",
			"Cashew",
			"Cat4D",
			"catchTender",
			"CategoryJS",
			"catl-deploySSH",
			"cbNetwork",
			"CbolaInfra",
			"CBQueue",
			"CBuffer",
			"ccNetViz",
			"ccPagination",
			"ccTpl",
			"censoreMio",
			"Censorify",
			"censorify_Publish20160706",
			"censorify_Vincent_Choe",
			"censorifyAD",
			"censorifyAshes",
			"censorifyGuangyi",
			"censorifyKatKat",
			"censorifyRayL",
			"censorifyTM",
			"CETEIcean",
			"cfUtilityService",
			"CFViews",
			"chadschwComponentTest0001",
			"changelogFDV",
			"Changling-dom",
			"CharLS.js",
			"Chart.Annotation.js",
			"Chart.CallBack.js",
			"Chart.Crosshairs.js",
			"Chart.HorizontalBar.js",
			"Chart.Smith.js",
			"Chart.Zoom.drag.js",
			"Chart.Zoom.js",
			"ChartTime",
			"chatSocketIo",
			"ChattingRoom",
			"checkForModuleDuplicates",
			"cheferizeIt",
			"chenouTestNode",
			"child_process",
			"chowYen",
			"chrome-localIp",
			"ChuckCSS",
			"ChuckNorrisException",
			"chunkArray",
			"cjdsComponents",
			"Class",
			"Classy",
			"clearInterval",
			"ClearSilver",
			"clearTimeout",
			"CLI-todo",
			"CLI-UI",
			"cliappRafa",
			"clientFrontEnd",
			"ClientStorage",
			"clipDouban",
			"ClipJS",
			"CloudMusicCover",
			"CloudStore",
			"Cls",
			"cluster",
			"CM-react-native-document-picker",
			"CM1",
			"coberturaJS",
			"codeStr",
			"Coeus",
			"COFFEENODE",
			"Coflux",
			"colegislate-DynamoDbEventRepository",
			"ColeTownsend",
			"collabProvidesModules",
			"CollectionMap",
			"colWidth.js",
			"com.emsaeng.cordova.plugin.AdMob",
			"com.nickreed.cordova.plugin.brotherPrinter",
			"com.none.alarmClock",
			"com.zwchen.firstPlugin",
			"com.zwchen.qqAdvice",
			"combineJS",
			"CometJS",
			"Comfy",
			"Comments",
			"CommentsJS",
			"comp-Fetch",
			"Company",
			"compareStrings",
			"CompassSM",
			"Complex",
			"componentDoc",
			"componentDoc-cli",
			"CompoundSignal",
			"Compress-CSS",
			"Compression",
			"concatAll",
			"Concur",
			"ConfluencePageAttacher",
			"ConnectTheDotsDesktop",
			"Console",
			"console",
			"constants",
			"constelation-Animate_",
			"constelation-BackgroundImage",
			"constelation-Block",
			"constelation-Button",
			"constelation-Col",
			"constelation-Event_",
			"constelation-Flex",
			"constelation-Inline",
			"constelation-InlineBlock",
			"constelation-InlineCol",
			"constelation-InlineFlex",
			"constelation-InlineRow",
			"constelation-Painter",
			"constelation-Row",
			"constelation-Style_",
			"constelation-Text",
			"constelation-Video",
			"constelation-View",
			"ConstraintNetwork",
			"ContactMe",
			"ContentEdit",
			"ContentSelect",
			"ContentTools",
			"convertPinyin",
			"CoolBeans",
			"Coolhelper",
			"copyMe",
			"cordova-plugin-adPlayCafebazaar",
			"cordova-plugin-adPlayPushe",
			"cordova-plugin-bluetoothClassic-serial",
			"cordova-plugin-coolFunction",
			"cordova-plugin-euroart93-smartConfig",
			"cordova-plugin-ios-android-IAP",
			"cordova-plugin-LineLogin",
			"Cordova-Plugin-OpenTok-JBS",
			"cordova-plugin-permissionScope",
			"cordova-plugin-SchaffrathWebviewer",
			"cordova-plugin-SDKAW",
			"Cordova-Plugin-SystemBarDimmer",
			"cordova-plugin-YtopPlugin",
			"Cordova-react-redux-boilerplate",
			"cordova-StarIO-plugin",
			"CordovaSMS",
			"CordovaWebSocketClientCert",
			"coreApi",
			"CornerCut",
			"CornerJob",
			"CorrespondenceAnalysis",
			"cosBuffer",
			"cosTask",
			"Couch-cleaner",
			"Couchbase-sync-gateway-REST",
			"CouchCover",
			"CouchDBChanges",
			"CouchDBExternal",
			"CountAdd_000001",
			"cPlayer",
			"cqjPack",
			"Crawler",
			"Create-React-App-SCSS-HMR",
			"createClass",
			"createDOC",
			"createNpm",
			"createServer",
			"CRMWebAPI",
			"crockpot-fromBinary",
			"crockpot-fromEnglish",
			"crockpot-fromRoman",
			"crockpot-toEnglish",
			"crockpot-toRoman",
			"Cron",
			"CropSr",
			"crypto",
			"CSDebug",
			"CSDLParser",
			"CSLogger",
			"CSSMatrix",
			"CSSselect",
			"Csster",
			"CSSwhat",
			"CSV-JS",
			"CTP_MARKET_DATA",
			"cttv.bubblesView",
			"cttv.diseaseGraph",
			"cttv.expansionView",
			"cttv.flowerView",
			"cttv.speciesIcons",
			"cttv.targetAssociationsBubbles",
			"cttv.targetAssociationsTree",
			"cttv.targetGeneTree",
			"Cuber",
			"cubicColorPicker",
			"Cui-Dialog",
			"CustomCamera",
			"customComponent",
			"customLibrary",
			"CustomPlugin",
			"CustomWebView",
			"cuteLogger",
			"cwebp-binLocal",
			"CyberJS",
			"D",
			"d-fordeYoutube",
			"D-Stats",
			"D.Va",
			"d3-bboxCollide",
			"d3-pathLayout",
			"d3.geoTile",
			"D3.TimeSlider",
			"Daja",
			"Daniel_NPM_Library_Test",
			"Dante2",
			"DanTroy-utils",
			"Dashboard",
			"Dasher",
			"dashr-widget-Weather",
			"dashr-widget-World-Pool-Championships",
			"Data-CSS",
			"Data-Same-Height",
			"dataAccess",
			"Database-Jones",
			"DataManager",
			"dataStream",
			"dateFormat-kwen",
			"dateFormatW",
			"DateHuatingzi",
			"DateMaskr",
			"dateModule",
			"DatePicker",
			"Datepicker.js",
			"Dateselect",
			"DateValidator",
			"DateZ",
			"Datum",
			"Davis",
			"dd-rc-mStock",
			"DDEvents",
			"deBijenkorf-protractor-tests",
			"Debug-Tracker",
			"Deci-mal",
			"DeCurtis-Logger",
			"deepEqualsWith",
			"deepPick",
			"defaultStr",
			"Deferred",
			"deferredEventEmitter",
			"defineClass",
			"defineJS",
			"DelegateListener",
			"deleteMoudles",
			"Demo",
			"Demo1",
			"demoNeeeew",
			"demoWei",
			"demoYTC",
			"Deneme",
			"derivco-SoundJS",
			"derpModule",
			"DeskSet",
			"Desktop-command",
			"Devbridge-FrontEnd",
			"Developer",
			"deviousknightFirstNpm",
			"devisPattern",
			"devProxy",
			"DFP",
			"dgram",
			"dgURI",
			"diagnostics_channel",
			"Dial",
			"DiggernautAPI",
			"Diogenes",
			"DirScanner",
			"dirStat",
			"DirWatcher",
			"Discord-Webhook",
			"DiscordForge",
			"diveSync",
			"dkastner-JSONPath",
			"DM.NodeJS",
			"dns",
			"Dock-command",
			"docxtemplaterCopy",
			"doLink",
			"DOM",
			"Domai.nr",
			"domain",
			"DOMArray",
			"DOMBuilder",
			"DOMino",
			"DOMtastic",
			"DOMtastic-npm",
			"dotFormat",
			"dotJS",
			"DoubleCheck",
			"Dove.js",
			"downloadAPI",
			"downLoadFile",
			"DownloadManager",
			"DownloadProxy",
			"DPS",
			"DQ",
			"draftjsToHTML",
			"dragOnZone",
			"drakovNew",
			"Draper",
			"DrawPDF",
			"Dribble",
			"Drupal-Node.js",
			"DT",
			"Duckface",
			"Dui",
			"DVA",
			"DvA",
			"dVa",
			"DXIV2Inst",
			"DynamicBuffer",
			"dynamoDB",
			"DynamoDBStream",
			"DynWorker",
			"Easy-Peasy-Slide",
			"easyCache",
			"easyFe",
			"easyRestWithABL",
			"EasyUI",
			"eavesTool",
			"EBI-Icon-fonts",
			"echartsEx",
			"EclipseScroll",
			"ECMASquasher",
			"edfToHtmlConverter",
			"edGoogleApi",
			"edGraham",
			"EfemerideList",
			"efemerideList",
			"efficientLoad",
			"eFishCrawler",
			"EhanAreesha",
			"Elastic-Beanstalk-Sample-App",
			"ElasticSlider-core",
			"electron-isDev",
			"ElectronAppUpdater",
			"ElectronRouter",
			"elementsJS",
			"Elixirx",
			"Elm-0.17-Gulp-Coffeescript-Stylus-Lodash-Browserify-Boilerplate",
			"EmailClient",
			"ember-cli-fullPagejs",
			"ember-leaflet-geoJSON",
			"emoJiS-interpreter",
			"Empite",
			"EmpiteApp",
			"emptyObject",
			"emptyString-loader",
			"Encloud",
			"encodeBase64",
			"encodeID",
			"energyCalculator-browser",
			"EnglishTranslator",
			"ensureDir",
			"Enumjs",
			"Environment.js",
			"ep_disableChat",
			"EPO_OPS_WRAPPER",
			"equalViews-comparative-selection",
			"eRx-build",
			"ES-poc",
			"es6-DOM-closest",
			"eSlider",
			"eslint-plugin-elemMods",
			"EsmalteMx.ProductApi.Lambdas",
			"Estro",
			"ETag",
			"eValue-bs",
			"EVE",
			"EventDispatcher",
			"eventDrops",
			"EventEmitter",
			"EventField",
			"EventFire",
			"EventFire.js",
			"EventHub",
			"EventRelayEmitter",
			"events",
			"EventServer",
			"eventstore.mongoDb",
			"EventtownProject",
			"EventUtil",
			"EVEoj",
			"EverCookie",
			"ewdDOM",
			"ewdGateway",
			"ExBuffer",
			"execSync",
			"exFrame-configuration",
			"exFrame-core",
			"exFrame-generator",
			"exFrame-logger",
			"exFrame-mq",
			"exFrame-rest",
			"exFrame-rpc",
			"exFrame-security",
			"ExifEditor",
			"Exitent",
			"expectThat.jasmine-node",
			"expectThat.mocha",
			"Express",
			"Express-web-app",
			"expressApi",
			"ExpressCart",
			"ExpressCheckout",
			"expressingFounder",
			"ExpressMVC",
			"ExpressNode",
			"expressOne",
			"expressSite",
			"expressWeb",
			"ExtraInfo",
			"extraRedis",
			"Eyas",
			"EzetechT",
			"EZVersion",
			"F",
			"F-chronus",
			"f*",
			"FabioPluginiUno",
			"Facebook_Graph_API",
			"facebookPhotos",
			"FacebookYarn",
			"factor-bundle-WA64",
			"FAEN",
			"Faker",
			"Falcon",
			"fast-artDialog",
			"fastA_node",
			"FastLegS",
			"Fayer",
			"fbRecursiveRequest",
			"FeedbackModuleTest",
			"feedBum",
			"fenix-ui-DataEditor",
			"fenix-ui-DSDEditor",
			"Fermi-UI",
			"FetchCallLog",
			"fieldsValidator",
			"fig-Componts",
			"File",
			"File_Reader_solly",
			"FileBrowser",
			"FileError",
			"fileGlue",
			"FileList",
			"fileLog",
			"FilePicker-Phonegap-iOS-Plugin",
			"FileReader",
			"FileSaver",
			"FileSync",
			"FileWriter",
			"FileWriterSync",
			"Finder-command",
			"FirstApp",
			"FirstCustomPlugin",
			"firstModule",
			"firstNodejsModule",
			"firstYarn",
			"fis-parse-requireAsyncRes",
			"fis-postpackager-inCSSToWebP",
			"fis3SmartyTool",
			"FitText-UMD",
			"Flamingo",
			"flatToTrees",
			"fleschDe",
			"Flex-With-Benefits",
			"FlickrJS",
			"flipPage",
			"Florence",
			"FlowerPassword",
			"flowMap",
			"FLTEST",
			"fnProxy",
			"FontAwesome-webpack",
			"fontEnd",
			"FontLoader",
			"foo!",
			"foo~",
			"forAsync",
			"ForceCode",
			"forceLock",
			"forChangeFilesName",
			"forEachAsync",
			"formAnimation",
			"formatDate",
			"formBuilder",
			"FormData",
			"Formless",
			"formValidate",
			"FrameGenerator",
			"freightCrane",
			"French-stemmer",
			"Frenchpress",
			"FreshDocs",
			"friendsOfTrowel-buttons-component",
			"friendsOfTrowel-dropdowns-component",
			"friendsOfTrowel-Forms-component",
			"friendsOfTrowel-Layouts-component",
			"Friggeri.net",
			"Frog",
			"frontBuild",
			"Frontend-starter",
			"FrontEndCentral-documentation",
			"FrontJSON",
			"FrontPress",
			"Frozor-Logger",
			"Fruma",
			"fs",
			"fs-uTool",
			"FSM",
			"FT232H",
			"fuck!",
			"Fuell",
			"FuellDocTest",
			"FuellSys",
			"FuellTest",
			"FullStack",
			"FunDemo2",
			"FURI",
			"Fury",
			"futSearch",
			"futureDocBuilder",
			"FyreWorks-Node",
			"fzmFE",
			"Gaiam",
			"Ganescha-Bot-Jokes",
			"gaoboHello",
			"Garrett-pokemon",
			"gatesJs",
			"Gauge",
			"gaugeJS",
			"gaussianMixture",
			"gbL-jsMop",
			"GC-Sequence-Viewer",
			"gdBuildLogs",
			"gdBuilds",
			"Gems.PairedDeviceClient",
			"genData",
			"generateIndex",
			"generator-entityV2-widgets",
			"generator-kittJS",
			"generator-qccr-startKit",
			"generator-reactpackSample",
			"generator-zillionAngular",
			"Gengar",
			"GeoMatrix",
			"GeosysDroid",
			"GeosysTest",
			"Gerardo",
			"getDateformat",
			"getExtPath",
			"getSignature",
			"GettyEmbeddy",
			"ghostTools",
			"GhostTube",
			"GiftEditor",
			"GirlJS",
			"GitAzure",
			"gitbook-plugin-prism-ASH",
			"gitbook-plugin-specialText",
			"gitbook-start-heroku-P8-josue-nayra",
			"gitbook-start-heroku-P9-josue-nayra",
			"gitForge",
			"gitHub",
			"GitHub-Network-Graph",
			"GitHubTrending",
			"gitProvider",
			"gl-flyCamera",
			"gl-simpleTextureGenerator",
			"glMath",
			"GLORB",
			"glslCanvas",
			"glslEditor",
			"glslGallery",
			"GLSlideshow",
			"Glue",
			"GMP",
			"golbalModule",
			"Goldfish",
			"Gon",
			"Google_Plus_API",
			"Google_Plus_Server_Library",
			"Google-Chrome-command",
			"GoogleDrive",
			"googleOAuthServer",
			"googlePlaceAutocomplete",
			"GoogleService-NodeJs",
			"Gord",
			"gPagesJS",
			"Gps2zip",
			"GRAD_leaveNotes",
			"GRAD_makeFire",
			"grad-customGear",
			"grad-factions-VR",
			"grad-leaveNotes",
			"grad-makeFire",
			"Grafar",
			"Graph",
			"graphLock.custom.plugin",
			"graphQl-Mysql-Server",
			"GridFS",
			"GridManager",
			"gridminCss",
			"Gridtacular",
			"GroupePSAConnectedCar",
			"Grow.js",
			"Grunt-build",
			"grunt-checkFileSize",
			"grunt-cmd-handlebarsWrap",
			"grunt-ftp-getComponent",
			"grunt-httpTohttps",
			"grunt-latexTOpdf-conversion",
			"grunt-Npm-grunts",
			"grunt-po2mo-multiFiles",
			"grunt-Replacebyrefs",
			"grunt-syncFolder",
			"grunt-urlCacheBuster",
			"guideJs",
			"gulp-addSuffix",
			"gulp-combineHtml",
			"gulp-imgToBase64",
			"gulp-lowerCase",
			"gulp-phpWebserver",
			"gulp-spacingWord",
			"Gulp-Tasks",
			"GumbaJS",
			"Gusto",
			"gz2qiCalcModule",
			"h2oUIKit",
			"H5UI",
			"H666",
			"habibtestPublish",
			"HackBuffer",
			"handleStr",
			"HansontableComponent",
			"Haraka",
			"HariVignesh",
			"harmonyHubCLI",
			"HarryPotterParty",
			"harsh-Test-Module",
			"Harshil",
			"hash!",
			"hashPage",
			"hashTranslate",
			"HASWallpaperManager",
			"hasWord",
			"HeartBeatWoT_pi",
			"Hello",
			"hello_test_spade69XXX",
			"Hello_World",
			"HelloBot",
			"helloBySoo",
			"helloDevelopersnodejs",
			"HelloExpress",
			"helloModule",
			"HelloWorld",
			"helloWorld",
			"HelloWorld_hlhl_040",
			"HelloWorldComponent",
			"HelloWorldNodeJS",
			"helloYJ",
			"helpBy",
			"helpCenter",
			"herokuRun",
			"Hesiir-components",
			"HHello",
			"Hidash",
			"HiddenMarkovModel",
			"hideShowPassword",
			"highcharts-*",
			"HighlightP",
			"Highway",
			"Hinclude",
			"Hipmob",
			"Hiraku",
			"hm_firstPackage",
			"HMTraining",
			"homebridge-anelPowerControl",
			"homebridge-bigAssFans",
			"homebridge-CurrentAmbientLightLevel",
			"homebridge-Homeseer",
			"homebridge-LEDStrip",
			"homebridge-MotionSensor",
			"homebridge-RFbulb",
			"Homematic-Hue-Interface",
			"hoshiCustomContent",
			"hoshiImageLoader",
			"HotJS",
			"Hotshot",
			"hoverifyBootnav",
			"howToNPM",
			"Hppy",
			"Hpy",
			"htmlCutter",
			"htmlKompressor",
			"HTMLString",
			"htmlToTree",
			"http",
			"http2",
			"HTTPRequest",
			"https",
			"httpShell",
			"httpTohttps",
			"Hubik",
			"Hubik-Demo",
			"Hubik-Platform",
			"Hubik-Platform-Chrome",
			"Hubik-Plugin",
			"Hubik-Plugin-Memory",
			"Hubik-Plugin-Network",
			"Hubik-Plugin-Rendering",
			"Hubik-Util",
			"hubot-yigeAi",
			"HuK",
			"hybridCrypto",
			"i18next.mongoDb",
			"Ian_Chu",
			"IArray",
			"Ibis.js",
			"iCompute",
			"iEnhance",
			"IENotification",
			"iFrameAPI",
			"IFY-gulp-kit",
			"II",
			"IIF",
			"iIndexed",
			"iKeyed",
			"iM880-serial-comm",
			"imageCDN-webpack-loader",
			"imageMagick",
			"Imager",
			"Imageresizer",
			"imageTool",
			"ImageViewer",
			"iMagPay",
			"iMemoized",
			"iMessageModule",
			"Imovie",
			"Imp",
			"Incheon",
			"Index",
			"indexedStore",
			"inferModule-jsdoc-plugin",
			"infieldLabel",
			"Influxer",
			"inputcheckMemo",
			"inspector",
			"INSPINIA",
			"Insplash",
			"inStyle",
			"interactiveConsole",
			"Interval",
			"IO",
			"IObject",
			"ionic-gulp-browserify-typescript-postTransform",
			"IonicSocket",
			"iOS-HelloWorld",
			"IOTSDK",
			"iotsol-app-FAN",
			"iotsol-app-test-Node-RED",
			"iotsol-service-string-upperCase",
			"IQVIS",
			"Iris",
			"iRobo-react-modal",
			"iSecured",
			"isElementInViewport",
			"isEqual",
			"iSeries",
			"isFirefoxOrIE",
			"isHolidayInChina",
			"iSocketService",
			"isPureFunction",
			"iStorable",
			"iTransactable",
			"iTunes-command",
			"iValidated",
			"iWeYou",
			"iZettle",
			"iziModal",
			"JabroniJS",
			"jaCodeMap",
			"Jade-Sass-Gulp-Starter",
			"jadeBundler",
			"jadiTest",
			"jAlert",
			"JamSwitch",
			"JASON",
			"JavaScript-101",
			"JazzScript",
			"jcarouselSwipe",
			"jDataView",
			"jDate",
			"jetsExt",
			"Jimmy-Johns",
			"jingwenTest",
			"JMSList",
			"JMSlist.js",
			"Jody",
			"jordenAngular",
			"jordenAngular2",
			"JorupeCore",
			"JorupeInstance",
			"JOSS",
			"JotihuntReact",
			"Journaling-Hash",
			"jpaCreate",
			"jParser",
			"JPath",
			"jPlotter",
			"jPlugins",
			"JQ",
			"jQ-validation-laravel-extras",
			"JQDeferred",
			"jQGA",
			"jqGrid",
			"jqNode",
			"jqPaginator",
			"jqplot.donutRenderer",
			"jqPromise4node",
			"jqTreeGridWithPagination",
			"jQuery",
			"jquery-adaptText",
			"jquery-asAccordion",
			"jquery-asBgPicker",
			"jquery-asBreadcrumbs",
			"jquery-asCheck",
			"jquery-asChoice",
			"jquery-asColor",
			"jquery-asColorPicker",
			"jquery-asDropdown",
			"jquery-asFontEditor",
			"jquery-asGalleryPicker",
			"jquery-asGmap",
			"jquery-asGradient",
			"jquery-asHoverScroll",
			"jquery-asIconPicker",
			"jquery-asImagePicker",
			"jquery-asItemList",
			"jquery-asModal",
			"jquery-asOffset",
			"jquery-asPaginator",
			"jquery-asPieProgress",
			"jquery-asProgress",
			"jquery-asRange",
			"jquery-asScroll",
			"jquery-asScrollable",
			"jquery-asScrollbar",
			"jquery-asSelect",
			"jquery-asSpinner",
			"jquery-asSwitch",
			"jquery-asTooltip",
			"jquery-asTree",
			"jQuery-by-selector",
			"jquery-dynamicNumber",
			"jquery-idleTimeout-plus",
			"jquery-loadingModal",
			"jquery-navToSelect",
			"jQuery-QueryBuilder",
			"jquery-rsLiteGrid",
			"jquery-rsRefPointer",
			"jquery-rsSlideIt",
			"jQuery-Scanner-Detection",
			"jquery-scrollTo",
			"jquery-scrollToTop",
			"jquery-slidePanel",
			"jQuery.component",
			"jquery.customSelect",
			"jquery.dataTables.min.js",
			"jquery.Jcrop.js",
			"jQuery.keyboard",
			"jQuery.mmenu-less",
			"jQuery.print",
			"jquery.rsLiteGrid",
			"jquery.rsOverview",
			"jquery.rsRefPointer",
			"jquery.rsSlideIt",
			"jquery.rsSliderLens",
			"jQuery.toggleModifier",
			"jquery.waitforChild",
			"jqueryPro",
			"js-build-RomainTrouillard",
			"JS-Entities",
			"JS-string-minimization",
			"JS.Responsive",
			"jSaBOT",
			"jsCicada",
			"jsConcat",
			"JSCPP",
			"jsDAV",
			"JSDev",
			"jsdoc-TENSOR",
			"jsDocGenFromJson",
			"jsDump",
			"jSelect",
			"JSErrorMonitor",
			"JSErrorMonitor-server",
			"jsFeed",
			"jsFiddleDownloader",
			"JSFramework",
			"JSLint-commonJS",
			"JSLintCli",
			"JSLogger",
			"JSON",
			"JSON-Splora",
			"JSON.sh",
			"JSON2",
			"json8-isArray",
			"json8-isBoolean",
			"json8-isJSON",
			"json8-isNull",
			"json8-isNumber",
			"json8-isObject",
			"json8-isPrimitive",
			"json8-isString",
			"json8-isStructure",
			"JSON2016",
			"JSONloops",
			"JSONPath",
			"JSONPathCLI",
			"JSONRpc",
			"JSONSelect",
			"JSONStream",
			"JsonUri",
			"JSONUtil",
			"jsonX",
			"JSplay",
			"jspolyfill-array.prototype.findIndex",
			"JSPP",
			"JSpring",
			"jsQueue",
			"jsSourceCodeParser",
			"jStat",
			"JSUS",
			"JSV",
			"JSX",
			"jsz-isType",
			"JTemplate",
			"JTmpl",
			"jTool",
			"JuliaStyles",
			"JumanjiJS",
			"Jupyter-Git-Extension",
			"justifiedGallery",
			"justJenker",
			"JustMy.scss",
			"JWBootstrapSwitchDirective",
			"jWorkflow",
			"jxLoader",
			"JYF_restrict",
			"K_Tasks",
			"K--Ajax",
			"K-Report",
			"KAB.Client",
			"Kahana",
			"Kapsel-project",
			"Katy",
			"Kayzen-GS",
			"KB",
			"KB_Model",
			"kelTool",
			"kelTool2",
			"KenjutsuUI",
			"KevinLobo3377-node",
			"KFui",
			"kickoff-fluidVideo.css",
			"Kid",
			"kingBuilder",
			"kiranApp",
			"Kirk",
			"Kissui",
			"kittJS",
			"Kiwoom-Helper",
			"KLC3377-node",
			"knockout.ajaxTemplateEngine",
			"koa-artTemplate",
			"koa-Router",
			"koaPlus",
			"koaVue",
			"KonggeIm",
			"kpPublicPerson",
			"kpPublicVideo",
			"krawlerWash",
			"ktPlayer",
			"kylpo-BackgroundImage",
			"kylpo-Block",
			"kylpo-Button",
			"kylpo-Col",
			"kylpo-Flex",
			"kylpo-Inline",
			"kylpo-InlineBlock",
			"kylpo-InlineCol",
			"kylpo-InlineFlex",
			"kylpo-InlineRow",
			"kylpo-Paint",
			"kylpo-Painter",
			"kylpo-Row",
			"kylpo-Text",
			"kylpo-View",
			"kzFormDaimyo",
			"L.TileLayer.Kartverket",
			"L7",
			"labBuilder",
			"Lactate",
			"Lade",
			"laravel-jQvalidation",
			"Large",
			"lark-PM",
			"LasStreamReader",
			"latte_web_ladeView",
			"latte_webServer4",
			"lavaK",
			"layaIdecode",
			"Layar",
			"Layout",
			"LazyBoy",
			"lazyBum",
			"lazyConnections",
			"lazyLoadingGrid",
			"lcAudioPlayer",
			"LCM",
			"LDAP",
			"Leaf.js",
			"Leaflet-MovingMaker",
			"Leaflet.AutoLayers",
			"Leaflet.Deflate",
			"Leaflet.GeoJSON.Encoded",
			"Leaflet.GreatCircle",
			"Leaflet.MultiOptionsPolyline",
			"Leaflet.TileLayer.MBTiles",
			"Leaflet.vector-markers",
			"leapShell",
			"LearningNPM",
			"learnnode_by_HHM",
			"leFunc",
			"Legos",
			"Libby-Client",
			"LightCinematic",
			"lihuanxiangNpm1",
			"limitedQueue",
			"linearJs",
			"lineReader",
			"Lingo",
			"LinkedList",
			"linkIt",
			"LISP.js",
			"liteParse",
			"liuchengjunOrder0414",
			"LiveController",
			"LiveDocument",
			"LiveScript",
			"LiveScript-brunch",
			"LiveView",
			"liweiUitl",
			"lizaorenqingTool",
			"lmONE",
			"LMUI",
			"LMX-Data",
			"LNS_weixin_h5",
			"localeMaker_v1",
			"localforage-memoryStorageDriver",
			"LocalRecord",
			"localStorage",
			"localStorage-info",
			"localStorage-mock",
			"LoDashfromScratch",
			"lofterG",
			"Loganalyzer",
			"LogbookMessageCreator",
			"Logger",
			"Logging",
			"Loggy",
			"logic2UI",
			"LogosDistort",
			"LogStorage.js",
			"logStream",
			"LOL",
			"lolAJ",
			"LongestCommonSubstring",
			"loop-setTimeout",
			"loopback-connector-rest-addCookie",
			"lopataJs",
			"Lorem",
			"Losas",
			"LP_test_task",
			"Lucy",
			"LUIS",
			"LUIS_FB",
			"Lumenize",
			"Lush.js",
			"LykkeFramework",
			"M66_math_example",
			"mac-cropSr",
			"MacGyver",
			"Mad.js",
			"magentoExt",
			"Maggi.js",
			"Maggi.js-0.1",
			"MagpieUI",
			"MALjs",
			"Mambo-UI",
			"mangoSlugfy",
			"mapleTree",
			"mappumBot",
			"Marionette-Require-Boilerplate",
			"markupDiff",
			"marryB",
			"MasterDetailApplication",
			"MaterialAngularWithNodeJS",
			"Math",
			"math_example_20160505163300BR",
			"math_example_Hala",
			"math_example_myown_ve-01119310520_V2",
			"math_exampleCJG",
			"math_exampleII",
			"math_exampleX",
			"math_ThisIsMe",
			"math-Murasame",
			"Math1105",
			"mathAdd",
			"mathExample",
			"MathJax-node",
			"MathJS",
			"mathMagic",
			"MathTest1",
			"MatPack",
			"Mavigator",
			"MAX-AVT-homebridge-led",
			"MAXAVTDemo",
			"MAXIMjs",
			"MaxUPS",
			"MCom",
			"MD5",
			"MDLCOMPONENT",
			"mdlReact",
			"mdPickers",
			"mdRangeSlider",
			"mdToPdf",
			"MEAN",
			"MeanApp1",
			"MeCab",
			"mediaCheck",
			"Mediany",
			"medicalHistory",
			"Mercury",
			"Meridix-WebAPI-JS",
			"Mers",
			"MessageBus",
			"MetaEditor",
			"Meteor-Test-Installer",
			"MetroTenerife",
			"MFL-ng",
			"MFRC522-node",
			"mglib-GAMS.WEBCLIENT2",
			"MIA",
			"MicroServices",
			"Midgard",
			"midhunthomas_Test",
			"mihoo_fileUpload",
			"mini-fileSystem-WebServer",
			"Mini-test",
			"MiniAppOne",
			"MiniAppTwo",
			"minibuyCommonality",
			"miniJsonp",
			"MiniManager",
			"MiniMVC",
			"MinionCI",
			"Minju003",
			"Mirador",
			"Misho_math_example",
			"MJackpots",
			"mjb44-playground-module-exporting-interface-and-type-method-B",
			"mjb44-playground-module-exporting-interface-and-type-method-C",
			"Mkoa",
			"Mkoa-pg-session",
			"MKOUpload",
			"mlm603Test",
			"mmAnimate",
			"mmDux",
			"MMM-alexa",
			"mmRequest",
			"mmRouter",
			"mNotes",
			"Mockery",
			"modalDemo",
			"modalDemo1",
			"modalWin.js",
			"module",
			"ModuleBinder",
			"modulebyAKB",
			"ModuleC",
			"moduleLoader",
			"moduleTest",
			"MoEventEmitter",
			"Mokr",
			"Mole",
			"mon-appNon0",
			"MonApp",
			"MongoDAL",
			"mongoose-schema-to-graphQL",
			"mongooseSchema-to-graphQL",
			"Monik",
			"MonikCommon",
			"MoniqueWeb",
			"Monorail.js",
			"Mopidy-Spotmop",
			"mosesCheckIn",
			"MovieJS",
			"mOxie",
			"MoxtraPlugin_1.1",
			"MoxtraPlugin_1.2.1",
			"mPortalUI",
			"MQTTClient",
			"Mr.Array",
			"Mr.Async",
			"Mr.Coverage",
			"mraaStub",
			"MrsYu",
			"MrsYu1",
			"msGetStarted",
			"mSite",
			"msJackson",
			"mSnackbar",
			"Mu",
			"Muffin",
			"MultiSlider",
			"musuAppsas",
			"MWS_Automation",
			"my-awesome-nodejs-moduleHL",
			"my-componentAnimesh",
			"My-First-Module",
			"My-first-Package",
			"My-Fist-Project",
			"my-HLabib",
			"My1ink",
			"MyAngularGruntt",
			"MyAnimalModule",
			"myappSriniAppala",
			"myappUSBankExample",
			"myAries",
			"MyBlog",
			"myCalclator",
			"myDate",
			"myDialog",
			"myDu2",
			"myDVA",
			"myFirst-Nodejs-Module",
			"MyFirstContribution",
			"myfirstDemo",
			"myFirstModule",
			"myFirstNodeModule",
			"myFirstNpm",
			"myFirstPluginAji",
			"myFirstProject",
			"myFirstPub",
			"myLib",
			"myMath",
			"MYMODAL",
			"MyModule",
			"myModule",
			"myNodeJs",
			"myNodeJsApp",
			"myNodejsApp",
			"myNpm",
			"MYnpm1",
			"myNpm0001",
			"myNpm2",
			"myNpm5",
			"myNpm10",
			"myNpm11",
			"myNpm111",
			"myNpm999",
			"myNpmfei",
			"myNpmfei1",
			"myNpml",
			"myNpmModule",
			"myNpmrz1",
			"MyPlugin",
			"MyProject",
			"MyProjNode",
			"myPromise",
			"myrikGoodModule",
			"Mysql-Assistant",
			"mysupermoduleXXX",
			"myTest",
			"Mytest_module",
			"mytPieChart",
			"N",
			"N3-components",
			"NA1",
			"NageshTestapplication",
			"NAME",
			"Nameless13",
			"NaNNaNBatman.js",
			"nanoTest",
			"NasimBotPlatform",
			"NativeAds",
			"NativeCall",
			"NativeProject",
			"nativescript-CallLog",
			"nativescript-GMImagePicker",
			"nativescript-logEntries",
			"NavExercise",
			"nCinoRabbit",
			"ncURL",
			"NDDB",
			"neouiReact-button",
			"Neptune",
			"NERDERY.JS.NAT",
			"nestedSortable",
			"net",
			"NeteaseCloudMusicApi",
			"neteaseMusicApi",
			"Netflow",
			"Netlifer",
			"NetMatch",
			"NetOS",
			"netOS",
			"Netpath-Test",
			"Neuro",
			"Neuro-Company",
			"NewModule1",
			"newmsPong",
			"newPackage",
			"newPioneer",
			"newStart",
			"newtouchCloud",
			"NewWebview",
			"NexManager",
			"NexmoJS",
			"NFO-Generator",
			"ng2-clockTST",
			"ng2-dodo-materialTypeTransfer",
			"ng2-QppWs",
			"ng2GifPreview",
			"NG2TableView",
			"ngBrowserNotification",
			"ngCart",
			"ngChatScroller",
			"ngComponentRouter-patched",
			"ngCurrentGeolocation",
			"ngDfp",
			"ngDrag",
			"ngFileReader",
			"ngGen",
			"ngGeolocation",
			"ngHyperVideo",
			"ngIceberg",
			"ngImgHandler",
			"ngIntercom",
			"ngKit",
			"ngPicker",
			"ngPluralizeFilter",
			"ngPluralizeFilter2",
			"ngProgress-browserify",
			"ngScroll",
			"ngSinaEmoji",
			"ngSmoothScroll",
			"ngSqlite",
			"ngTile",
			"ngTimeInput",
			"ngTreeView",
			"ngUpload",
			"ngUpload-forked",
			"Nguyen_test",
			"ngVue",
			"ngYamlConfig",
			"nHttpInterceptor",
			"Nick_calc",
			"NickSam_CGD",
			"NightPro-Web",
			"nightwatchGui",
			"Nikmo",
			"nImage",
			"Nitish",
			"nitish.kumar.IDS-LOGIC",
			"NlpTextArea",
			"nltco-lgpt-clean-A",
			"nltco-lgpt-clean-B",
			"nltco-lgpt-dedupe-simple-A",
			"nltco-lgpt-dedupe-simple-B",
			"nMingle",
			"nmPhone",
			"nMysql",
			"NoCR",
			"NODE",
			"Node_POC",
			"node-CORSproxy",
			"Node-FacebookMessenger",
			"Node-HelloWorld-Demo",
			"node-iDR",
			"node-iOS",
			"Node-JavaScript-Preprocessor",
			"node-localStorage",
			"Node-Log",
			"Node-Module-Test",
			"node-myPow",
			"node-red-contrib-samsungTV",
			"node-red-contrib-wwsNodes",
			"node-red-StefanoTest",
			"node-TBD",
			"NodeApp",
			"nodeApp",
			"nodeAuth",
			"nodeBase",
			"NodeBonocarmiol",
			"nodeCalcPax",
			"nodeCombo",
			"nodeDemo9.26",
			"nodeDocs",
			"nodeEventedCommand",
			"NodeFileBrowser",
			"NodeFQL",
			"nodeHCC",
			"nodeInterface",
			"NodeInterval",
			"nodeIRCbot",
			"nodeJS",
			"NodeJS_Tutorial",
			"nodeJs-zip",
			"NodejsAgent",
			"NodeJsApplication",
			"nodejsFramework",
			"nodejsLessons",
			"NodeJsNote",
			"NodeJsPractice",
			"nodeJsPrograms",
			"Nodejsricardo",
			"NodeJSTraining-demo-9823742",
			"nodejsTutorial",
			"NodejsWebApp1",
			"nodejsWorkSpace",
			"NodeKeynote",
			"nodeLearning",
			"nodeMarvin",
			"nodeMarvin2",
			"NodeMini",
			"nodeMysqlWrapper",
			"nodeNES",
			"nodeos-boot-multiUser",
			"nodeos-boot-singleUser",
			"nodeos-boot-singleUserMount",
			"nodepackageBoopathi",
			"nodePhpSessions",
			"NodePlugwise",
			"NodePlugwiseAPI",
			"nodeQuery",
			"nodes_Samples",
			"NodeSDK-Base",
			"NodeServerExtJS",
			"NodeSSH",
			"nodeSSO",
			"NodeSTEP",
			"nodeTest",
			"NodeTestDee",
			"nodeTTT",
			"nodeTut",
			"NoDevent",
			"NodeView",
			"nodeWebsite",
			"NodObjC",
			"Nonsense",
			"NoobConfig",
			"NoobHTTP",
			"normalizeName",
			"NORRIS",
			"nOSCSender",
			"Note.js",
			"NotificationPushsafer",
			"Notifly",
			"Npm",
			"npm-Demo",
			"Npm-Doc-Study",
			"npm-mydemo-pkgTest",
			"npm-setArray",
			"npm-wwmTest",
			"npmCalc",
			"npmFile",
			"npmModel",
			"npmModel1",
			"npmModel2",
			"npmTest",
			"npmToying",
			"npmTutorial",
			"NPR_Test",
			"nrRenamer",
			"nStoreSession",
			"nTPL",
			"nTunes",
			"NudeJS",
			"nunjucks-includeData",
			"O",
			"O_o",
			"o_O",
			"O2-countdown",
			"O2-tap",
			"objectFitPolyfill",
			"ObjectSnapshot",
			"ObjJ-Node",
			"ObservableQueue",
			"OCA-api",
			"ocamlAlpha",
			"ocamlBetterErrors",
			"OcamlBytes",
			"ocamlBytes",
			"ocamlRe",
			"OhMyCache",
			"OK-GOOGLE",
			"Olive",
			"onBoarding",
			"OnCollect",
			"OneDollar.js",
			"oneTest",
			"OpenBazaar-cli",
			"OpenDolphin",
			"OpenJPEG.js",
			"openWeather",
			"OperatorUI",
			"OPFCORS",
			"OPFSalesforce",
			"OptionParser",
			"OrangeTree",
			"Orchestrator",
			"Order",
			"ORIENTALASIAN",
			"os",
			"Osifo-package",
			"osu-ModPropertiesCalculator",
			"OTPAutoVerification",
			"overloadedFunction",
			"OwnMicroService",
			"OwnNormalizer",
			"OwnPubSub",
			"OwnPubSubClient",
			"OwnPubSubServer",
			"p2Pixi",
			"PaasyMcPaasFace",
			"pacemakerJS",
			"packAdmin",
			"Package",
			"packageNodeCR-Jeff.json",
			"packagePublished",
			"packageTesting",
			"Packery-rows",
			"packing-template-artTemplate",
			"Paddinator",
			"Paginate",
			"palindromeCalcPax",
			"palindromePax",
			"PanPG",
			"Panzer",
			"parameterBag",
			"paramsValidator",
			"Parse-Server-phone-number-auth",
			"parseArgs",
			"Parser",
			"parseUri",
			"Particle",
			"Particleground.js",
			"PassiveRedis",
			"path",
			"PatternLabStarter",
			"patternReplacer",
			"paytmGratify",
			"PayzenJS",
			"pDebug",
			"pdf-to-dataURL",
			"pdfTOthumbnail_convert",
			"PeA_nut",
			"Peek",
			"PeepJS",
			"Pega.IO",
			"Peggy.js",
			"Percolator",
			"perf_hooks",
			"performJs",
			"pgnToJSON",
			"PHibernate",
			"phoeNix-cli",
			"phoenixCLI",
			"PhonegapAnalytics",
			"PhonegapBeacon",
			"PhonegapFeeds",
			"PhonegapGeofence",
			"PhonegapGrowth",
			"PhonegapLocations",
			"PhonegapPush",
			"picardForTynt",
			"PicoMachine",
			"Pictionary",
			"Pintu",
			"pjEmojiTest",
			"PJsonCouch",
			"PK",
			"PL8",
			"placeHolder.js",
			"PLATO",
			"PlayStream",
			"pluginCreater",
			"pluginHelloWorld",
			"pluginHelloworld",
			"pluginTest",
			"PlugMan",
			"pluuuuHeader",
			"PoistueJS",
			"Pokeball-Scanner",
			"PokeChat",
			"PokedexJS",
			"PokemonGoBot",
			"PokemonGoNodeDashboard",
			"polar-cookieParser",
			"pollUntil",
			"Polymer",
			"POM",
			"pomeloGlobalChannel",
			"pomeloScale",
			"portal-fe-devServer",
			"PostgresClient",
			"Postlog",
			"PowerPlanDisplay",
			"powerPlug",
			"PP",
			"ppublishDemo",
			"Pre",
			"Preprocessor",
			"PrettyCSS",
			"prettyJson",
			"PrimaryJS",
			"primerNodo",
			"primo-explore-LinkedData",
			"primo-explore-prmFacetsToLeft",
			"primo-explore-prmFullViewAfter",
			"primo-explore-prmLogoAfter",
			"primo-explore-prmSearchBarAfter",
			"PrimoEsempio",
			"Printer",
			"Prism",
			"prjTemplate",
			"Probes.js",
			"process",
			"proInterface",
			"Project-A-VK",
			"Prometheus",
			"Promise",
			"Promise.js",
			"PromiseContext",
			"promisify-syncStore",
			"PropagAPISpecification",
			"propCheckers",
			"Propeller",
			"properJSONify",
			"Proto",
			"proton-quark-rabbitMQ",
			"ProtVista",
			"ProUI-Utils",
			"ProvaSimone",
			"provinceCity.js",
			"PSNjs",
			"PTC-Creator",
			"ptyzhuTest_20160813",
			"PublishDemo",
			"publishDigitalCrafts2016",
			"PubSub",
			"pubsubJS",
			"pulsarDivya",
			"punycode",
			"PupaFM",
			"Puppet.svg",
			"PureBox",
			"PureBox-Gallery-PlayEngine",
			"purePlayer",
			"PushMessage",
			"PushPanel",
			"PushPlugin_V2",
			"pybee!batavia",
			"Q",
			"q-mod-cliElements",
			"q-mod-cliPrinter",
			"QAP-cli",
			"QAP-SDK",
			"Qarticles",
			"QnA_Fore",
			"QNtest",
			"qqMap",
			"qTip2",
			"QuadMap",
			"QuantumExperimentService",
			"querystring",
			"R",
			"R.js",
			"R2",
			"RAD.js",
			"Radical",
			"raehoweNode",
			"Rajas",
			"random-fullName",
			"randomCaddress",
			"randomCname",
			"randomCname.js",
			"randomLib",
			"randomNickname",
			"RandomSelection",
			"randomTestOne",
			"randString",
			"randString.js",
			"Range.js",
			"Rannalhi",
			"rAppid.js",
			"rAppid.js-server",
			"rAppid.js-sprd",
			"Rapydscriptify",
			"RaspiKids",
			"raZerdummy",
			"RCTMessageUI",
			"React_Components",
			"React-Carousel",
			"react-countTo",
			"react-creditCard",
			"React-ES5-To-ES6-Checklist",
			"react-input-dateTime",
			"react-InputText-component",
			"react-komposer-watchQuery",
			"react-materialUI-components",
			"react-native-accountKit",
			"react-native-cascadeGrid",
			"react-native-checkBox",
			"react-native-DebugServerHost",
			"React-Native-Form-Field",
			"react-native-isDeviceRooted",
			"react-native-LoopAnimation",
			"react-native-MultiSlider",
			"react-native-portableView",
			"react-native-swRefresh",
			"react-PPT",
			"React-Redux-Docker-Ngnix-Seed",
			"react-refresh-infinite-tableView",
			"React-Select-Country",
			"React-Tabs",
			"React-UI-Notification",
			"react-uploadFile",
			"reactClass",
			"reactcordovaApp",
			"ReactEslint",
			"reactFormComponentTest1",
			"reactGallery",
			"reactHeaderComponentTest1",
			"ReactHero",
			"reactIntlJson-loader",
			"ReactNaitveImagePreviewer",
			"ReactNative-checkbox",
			"reactNative-checkbox",
			"reactNativeDatepicker",
			"reactNativeLoading",
			"ReactNativeNavbar",
			"ReactNativeSlideyTabs",
			"ReactNativeSocialLogin",
			"ReactNativeStarterKit",
			"ReactNativeToastAndroid",
			"reactTwo",
			"ReactUploader",
			"readabilitySAX",
			"ReadableFeeds",
			"readline",
			"ReadSettings",
			"Reality3D",
			"reallySimpleWeather",
			"ReApp",
			"ReasonDB",
			"RecastAI-Library-JavaScript",
			"recordType",
			"recordWebsite",
			"RedisCacheEngine",
			"redisHelper",
			"reDIx",
			"RefreshMedia",
			"registerSendMsg",
			"reloadOnUpdate",
			"remoteFileToS3",
			"RemoteTestService",
			"removeNPMAbsolutePaths",
			"RentalAdvantage",
			"repl",
			"Replace",
			"Replace2.0",
			"Replen-FrontEnd",
			"replNetServer",
			"Require",
			"requireAsync",
			"Resin",
			"resolveDependencies",
			"responseHostInfo",
			"ReST-API",
			"RESTful-API",
			"Restifytest",
			"Restlastic",
			"RESTLoader",
			"Reston",
			"RestTest",
			"RetreveNumbers",
			"rgbToHexa",
			"RhinoStyle",
			"Richard",
			"richardUtils",
			"rinuts-nodeunitDriver",
			"Risks-Tables",
			"RNBaiduMap",
			"RNCommon",
			"RNSVG",
			"RNSwiftHealthkit",
			"rNums",
			"RobinGitHub",
			"Robusta",
			"RockSelect",
			"Router",
			"RP_Limpezas_Industriais",
			"Rpm",
			"RSK-Router",
			"RT-react-toolbox",
			"Rubytool",
			"runQuery",
			"runStormTest",
			"runTestScenario",
			"RunwayLogger",
			"RWD-Table-Patterns",
			"RWPromise",
			"Safari-command",
			"SafeObject.js",
			"Safood-Parse",
			"SaFood-Parse",
			"sahibindenServer",
			"salgueirimTeste",
			"samepleMicroservice",
			"samjs-mongo-isOwner",
			"Sample",
			"SamplePlugIn",
			"SandboxTools",
			"sandcastle_multiApp",
			"Sanitizer.js",
			"sanitizer.unescapeEntities",
			"Sardines",
			"Sass-Boost",
			"Sass-JSON",
			"Sass-layout",
			"Saturday",
			"SauceBreak",
			"sayHelloByone",
			"sbg-queueManager",
			"sbUtils",
			"SC-Expense-Plugin",
			"Scaffolding",
			"scalejs.metadataFactory",
			"ScgiClient",
			"Scheduler.js",
			"schema-inspector-anyOf",
			"scp-cleanRedis",
			"Scrap",
			"scriptTools",
			"scrollAnimation",
			"scrollPointerEvents",
			"ScrollShow",
			"Sdp-App",
			"seaModel",
			"searchBox.js",
			"SecChat",
			"SecureKeyStore",
			"segnoJS",
			"Seguranca",
			"SegurancaBrasilcard",
			"Select2",
			"selfAsync",
			"selfAutocomplete",
			"SelfieJS",
			"SenseJs",
			"SenseOrm",
			"Sentimental",
			"SeptemTool",
			"seqFlow",
			"SerialDownloader",
			"serveItQuick",
			"Server",
			"Service-Discovery-DLNA-SSDP",
			"serviceDiscovery",
			"SessionWebSocket",
			"Set",
			"setInterval",
			"setRafTimeout",
			"setTimeout",
			"SexyJS",
			"sfaClient",
			"sgBase",
			"sgCore",
			"sgFramework",
			"sgLayers",
			"sgSay",
			"Sharder",
			"ShareSDK",
			"SharingCMS",
			"Shave",
			"Sheet",
			"SHI-Shire",
			"sHistory",
			"ShowNativeContact",
			"SHPS4Node-auth",
			"SHPS4Node-cache",
			"SHPS4Node-commandline",
			"SHPS4Node-Config",
			"SHPS4Node-config",
			"SHPS4Node-cookie",
			"SHPS4Node-CSS",
			"SHPS4Node-dependency",
			"SHPS4Node-error",
			"SHPS4Node-file",
			"SHPS4Node-frontend",
			"SHPS4Node-init",
			"SHPS4Node-language",
			"SHPS4Node-log",
			"SHPS4Node-make",
			"SHPS4Node-optimize",
			"SHPS4Node-parallel",
			"SHPS4Node-plugin",
			"SHPS4Node-sandbox",
			"SHPS4Node-schedule",
			"SHPS4Node-session",
			"SHPS4Node-SQL",
			"shwang1aPackage1",
			"shy-Do",
			"shy-static-imgJoin",
			"SignaturePrinter",
			"Silvera",
			"simoneDays",
			"Simple",
			"Simple-Cache",
			"simple-hello-world-apiClientsideTest",
			"simple-jQuery-slider",
			"simpleArgsParser",
			"simpleCsvToJson",
			"SimpleHtdigest",
			"SimpleQueue",
			"SimpleRPC",
			"Simplog",
			"SingularityUI",
			"sip.js-mnQf2Q2R",
			"Sisense-node-schedule",
			"SITA-JS-Wrapper",
			"siteBuild",
			"Skadi",
			"SkelEktron",
			"SKRCensorText",
			"SkyLabels.js",
			"Skype-command",
			"slgComponents",
			"Slidebars",
			"Slidebars-legacy",
			"slidePage",
			"Slither-Server",
			"sLog",
			"slush-initPro",
			"Smaller4You",
			"Smart-Web-Proxy",
			"SmartConfig",
			"SmartyGrid",
			"SMValidator",
			"smyNpm1",
			"Snake.js",
			"SnipIt",
			"SnsShare",
			"SocialDig.js",
			"Socialight",
			"socketGW",
			"SocketIPC",
			"sortBy.js",
			"Soumen",
			"SoundCloud_Node_API",
			"SpaceMagic",
			"SpeechJS",
			"Speedco",
			"Speedonetzer",
			"Sphero-Node-SDK",
			"Spores",
			"Spot",
			"spotifyCurrentlyPlaying.js",
			"SpotlightJS",
			"Spring",
			"SPUtility.js",
			"SQLClient",
			"SQProject",
			"SquareOfNumber",
			"Squirrel",
			"squishMenu",
			"Sslac",
			"SSO",
			"SSSDemoNPM7oct",
			"SSuperSchool",
			"StaceFlow",
			"StanLee-WPTheme-Generator",
			"star-initReact",
			"Starr",
			"startInt",
			"starW-names",
			"StaticServer",
			"staticServer",
			"staticSync",
			"StatusBar",
			"StdJSBuilder",
			"steamAPI",
			"STEPNode",
			"Stewed",
			"stickUp",
			"stickyNavbar.js",
			"stickyStack",
			"StimShopPlugin",
			"storeJSON",
			"storkSQL",
			"stormClient",
			"Str.js",
			"Stratagem",
			"stream",
			"string_decoder",
			"String_module",
			"string-DLL",
			"string.prototype.htmlDecode",
			"string.prototype.htmlEntityDecode",
			"StringDistanceTS",
			"StringMultiplier",
			"StringScanner",
			"STRUCT",
			"Suckle",
			"sudokuMaker",
			"sudoTracker",
			"SUI-Angular2-Modal",
			"superClipBoard",
			"SuperDank",
			"superJoy",
			"Supermodule",
			"supermoduleBugay",
			"supermoduleLyu",
			"supermoduleNik",
			"supermoduleShulumba",
			"Supersonic",
			"superUsingMod",
			"svgSprite",
			"swimCoachStopwatch",
			"SwitchBoard",
			"synchro_ByJoker",
			"SyncRun",
			"Syndication",
			"Synergy",
			"sys",
			"Sysdate",
			"sytemMonitor-client",
			"szxPack",
			"T_T",
			"T-Box",
			"table-Q",
			"tableComponent",
			"Tachyon",
			"TagCloud",
			"tagOf",
			"TagSelect.js",
			"TalkerNode",
			"TALQS",
			"talquingApp",
			"TangramDocs",
			"tap-linux-2BA",
			"tap-win-2BA",
			"tap-win-C94",
			"Targis",
			"Tattletale",
			"Tayr",
			"tbCLI",
			"TDTwitterStream",
			"Tea",
			"TeamBuilder",
			"TechNode",
			"TechnoLib",
			"TeeChart",
			"Templ8",
			"Template",
			"Tempus",
			"Ter",
			"Tereshkovmodule",
			"Terminal-command",
			"test_helloWorld",
			"Test-7",
			"test-A",
			"test-naamat-Al-Aswad",
			"Test-Project",
			"TestAmILate",
			"testApi",
			"testApp",
			"Testchai2",
			"Testchai21",
			"testContrast",
			"TESTdelete123",
			"testDEMOABCD",
			"testDirJackAtherton",
			"Teste2",
			"testeRealTime",
			"testForThis",
			"testMe",
			"testModule",
			"testModule-hui",
			"testNode",
			"TestNodeJsApplication",
			"testPackage",
			"testPackage2",
			"TestPlugin",
			"testPlugin",
			"TestProject",
			"testProject",
			"testPublish",
			"testPublisha",
			"testPublishNpmModule",
			"TFWhatIs",
			"Thairon-node",
			"Thanatos_pack",
			"ThanhNV",
			"Theater",
			"TheGiver",
			"Thimble",
			"Thing.js",
			"thingHolder",
			"think-paymentService",
			"think-qiniuService",
			"think-quotationService",
			"think-wechatService",
			"ThinkHub",
			"ThinkInsteon",
			"ThirtyDaysOfReactNative",
			"threadHandler",
			"threejs-htmlRenderer",
			"ThrustFS",
			"ThumborJS",
			"TigraphBot",
			"tilejsonHttpShim",
			"Time-Tracker-Cli",
			"Timelined",
			"Timeliner.Core",
			"Timeliner.Index",
			"Timepass",
			"timers",
			"timeTraveller",
			"timeUtils",
			"tiNanta",
			"TinyAnimate",
			"tinyChat",
			"tinyEmiter",
			"tinyFrame",
			"tinyImages",
			"tinyLoger",
			"Titan",
			"TJAngular",
			"tls",
			"tm-apps-poolApi",
			"tmSensor",
			"toBin",
			"toDataURL",
			"toDoList",
			"toDots",
			"Toji",
			"tokenAndAuthorizationManager",
			"tokenAndAuthorizationManger",
			"Tom",
			"tomloprodModal",
			"Tool-bluej-gulp",
			"Toolshed-Client",
			"topSdk",
			"TopuNet-AMD-modules",
			"TopuNet-BaiduMap",
			"TopuNet-CalendarScroller",
			"TopuNet-dropDownLoad",
			"TopuNet-GrayScale",
			"TopuNet-ImageCropCompressorH5",
			"TopuNet-JRoll",
			"TopuNet-js-functions",
			"TopuNet-JsHint4Sublime",
			"TopuNet-JsHintify",
			"TopuNet-Landscape_mask",
			"TopuNet-Landscape-Mask",
			"TopuNet-LayerShow",
			"TopuNet-mobile-stop-moved",
			"TopuNet-node-functions",
			"TopuNet-Pic-code",
			"TopuNet-PromptLayer-JS",
			"TopuNet-QueueLazyLoad",
			"TopuNet-RequireJS",
			"TopuNet-RotatingBanner",
			"TopuNet-WaterFall",
			"TopuNet-weixin-node",
			"TorrentBeam",
			"TorrentCollection",
			"toSrc",
			"toString",
			"touchController",
			"toYaml",
			"TPA",
			"tr-O64",
			"trace_events",
			"TradeJS",
			"Trains",
			"TrainsController",
			"TrainsModel",
			"TramiteDocumentarioFront",
			"TransactionRelay",
			"transformConfigJson",
			"transitionEnd",
			"translateFzn",
			"Travis",
			"TrixCSS",
			"truncateFilename",
			"tslint-jasmine-noSkipOrFocus",
			"TSN",
			"ttm-Testing",
			"tty",
			"Tuio.js",
			"Turntable",
			"tuTrabajo-client",
			"TweenTime",
			"TwigJS",
			"twitterApiWrapper",
			"txtObj",
			"Tyche",
			"TypeCast",
			"typedCj.js",
			"TypedFunc",
			"typescript-demo-MATC-Andrew",
			"typography-theme-Wikipedia",
			"typopro-web-TypoPRO-AmaticSC",
			"typopro-web-TypoPRO-AnonymousPro",
			"typopro-web-TypoPRO-Asap",
			"typopro-web-TypoPRO-Astloch",
			"typopro-web-TypoPRO-BebasNeue",
			"typopro-web-TypoPRO-Bitter",
			"typopro-web-TypoPRO-Chawp",
			"typopro-web-TypoPRO-ComingSoon",
			"typopro-web-TypoPRO-Cousine",
			"typopro-web-TypoPRO-Coustard",
			"typopro-web-TypoPRO-CraftyGirls",
			"typopro-web-TypoPRO-Cuprum",
			"typopro-web-TypoPRO-Damion",
			"typopro-web-TypoPRO-DancingScript",
			"typopro-web-TypoPRO-Delius",
			"typopro-web-TypoPRO-Gidole",
			"typopro-web-TypoPRO-GiveYouGlory",
			"typopro-web-TypoPRO-GrandHotel",
			"typopro-web-TypoPRO-GreatVibes",
			"typopro-web-TypoPRO-Handlee",
			"typopro-web-TypoPRO-HHSamuel",
			"typopro-web-TypoPRO-Inconsolata",
			"typopro-web-TypoPRO-IndieFlower",
			"typopro-web-TypoPRO-Junction",
			"typopro-web-TypoPRO-Kalam",
			"typopro-web-TypoPRO-KingthingsPetrock",
			"typopro-web-TypoPRO-Kreon",
			"typopro-web-TypoPRO-LeagueGothic",
			"typopro-web-TypoPRO-Lekton",
			"typopro-web-TypoPRO-LibreBaskerville",
			"typopro-web-TypoPRO-Milonga",
			"typopro-web-TypoPRO-Montserrat",
			"typopro-web-TypoPRO-Nickainley",
			"typopro-web-TypoPRO-Oxygen",
			"typopro-web-TypoPRO-Pacifico",
			"typopro-web-TypoPRO-PatuaOne",
			"typopro-web-TypoPRO-Poetsen",
			"typopro-web-TypoPRO-Pompiere",
			"typopro-web-TypoPRO-PTMono",
			"typopro-web-TypoPRO-Rosario",
			"typopro-web-TypoPRO-SansitaOne",
			"typopro-web-TypoPRO-Satisfy",
			"typopro-web-TypoPRO-Signika",
			"typopro-web-TypoPRO-Slabo",
			"typopro-web-TypoPRO-TopSecret",
			"typopro-web-TypoPRO-Unifraktur",
			"typopro-web-TypoPRO-Vegur",
			"typopro-web-TypoPRO-VeteranTypewriter",
			"typopro-web-TypoPRO-WeblySleek",
			"typopro-web-TypoPRO-Yellowtail",
			"Ubertesters",
			"Ubi",
			"UbibotSensor",
			"UbidotsMoscaServer",
			"UbiName",
			"uDom",
			"ueberDB",
			"ueberDB-couch",
			"ueberRemoteStorage",
			"ugcFore",
			"UIjson",
			"UkGeoTool",
			"UltraServerIO",
			"UM007",
			"uMech",
			"uMicro",
			"uMicro-invoke",
			"UMiracleButton",
			"uncaughtException",
			"Underscore-1",
			"UnderscoreKit",
			"UnderscoreMatchersForJasmine",
			"underscorePlus",
			"underscoreWithTypings",
			"Uniform",
			"Unit-Bezier",
			"unity-kjXmol-1",
			"UniversalRoute",
			"Up2Bucket",
			"UParams",
			"UploadCore",
			"Uploader",
			"URIjs",
			"url",
			"URLON",
			"urlParser",
			"urlWatch",
			"USAJOBS",
			"USAJOBS_Help_Center",
			"UserID",
			"userModule1123455",
			"util",
			"utilityFileSystem",
			"utilityTool",
			"Utils",
			"uTool",
			"uTool2",
			"uvCharts",
			"v8",
			"Validate",
			"Validator",
			"VardeminChat",
			"vc-buttonGroup",
			"vcPagination",
			"vdGlslCanvas",
			"VDU-web",
			"Vector",
			"Velvet",
			"vericredClient",
			"VerifyInput.js",
			"Videobox-MODX",
			"videoBoxer",
			"VideoStream",
			"Vidzy",
			"ViewAbility",
			"ViewPort",
			"ViewTest",
			"vintageJS",
			"Virsical",
			"VK-Promise",
			"VLC-command",
			"vm",
			"VmosoApiClient",
			"vmSFTP",
			"VoiceIt",
			"voiceLive",
			"Votesy",
			"VoxFeed",
			"Voyager-search",
			"vPromise",
			"vQ",
			"vQMgArq1o4U1",
			"vsGoogleAutocomplete",
			"vue-dS",
			"vue-scrollTo",
			"vueLoadingBar",
			"VueProject",
			"VueProjectES5",
			"VueTree",
			"Vuk",
			"W2G2",
			"w5cValidator",
			"w11k-dropdownToggle",
			"Wamble",
			"wamTool",
			"Wanderer",
			"wangeditorForReact",
			"wantu-nodejsSDK",
			"wasabiD",
			"wasabiH",
			"wasi",
			"WasteOfTime",
			"WatchWorker",
			"watsonWebSocketSTTwrapper",
			"wb-Wisteria",
			"wBitmask",
			"wColor",
			"wColor256",
			"wConsequence",
			"wCopyable",
			"WCordova",
			"wDeployer",
			"Web_GUI_Core",
			"web3.onChange",
			"Web4.0",
			"webarrancoStarter",
			"WebConsoleUI",
			"Webcord",
			"webdriverNode",
			"webext-getBytesInUse-polyfill",
			"WebHook",
			"WebODF",
			"webpack-dev-server-getApp",
			"webpack-dynamicHash",
			"webpack-Minimount-starter",
			"WebParrot",
			"webpay-webserviceAPI",
			"webStart",
			"WebStencil",
			"webStorage",
			"wechat-enterprise-for-kfService",
			"wEventHandler",
			"wFiles",
			"wGluCal",
			"WhereThingsHappened",
			"WhiteRabbit",
			"WigGLe",
			"Wilson_U",
			"Wilson_Util",
			"WiredPanels",
			"wkhtmltopdfWrapper",
			"wLogger",
			"Wmhao",
			"WNdb",
			"WoD-Dice",
			"WolfyEventEmitter",
			"woodwoodnine_FirstTest",
			"wordCounting",
			"WordDuelConstants",
			"wPath",
			"wProto",
			"wqProj-cli",
			"wRegexpObject",
			"WSBroker",
			"wscn-tilesetQuote-component",
			"wsxRest",
			"wTemplate",
			"wTesting",
			"WTGeo",
			"wTools",
			"wy-checkBrowser",
			"X-date",
			"X-editable",
			"xBEM",
			"xlsTjson",
			"xlsxParser",
			"xmlToJsonTs",
			"Xnpmtools",
			"xSpinner",
			"xStore",
			"xui-vue-WorkflowArrow",
			"Xunfei",
			"xuNpm",
			"XWindow",
			"xwjApp",
			"xxxDemo",
			"yaDeferred",
			"YAEventEmitter",
			"yaMap",
			"yamQuery-excel",
			"yamQuery-excelAnalizer",
			"YamYam",
			"yang-testingNPM",
			"YaoXiaoMi",
			"Yeezy-Case",
			"Yggdrasil",
			"YJS",
			"YmpleCommerce",
			"YouAreDaChef",
			"YouSlackBot",
			"yrdLmz",
			"yuanMath",
			"YuicompressorValidator",
			"Yummy",
			"Yummy-Yummy",
			"YunUI",
			"Yworkcli",
			"Yworkshell",
			"z-lib-structure-dqIndex",
			"zhb_helloTest",
			"Zhengzx",
			"zigZag",
			"Ziz",
			"ZJJPackage",
			"zkModules",
			"zlib",
			"zmqConnector",
			"ZooKeeper",
			"zzcBridge",
			"zzcCopy",
			"zzcDownloadApp"
		];
	}));
	/**
	* @file Shared types, helpers, and utilities for `npm` PURL operations.
	*   Includes builtin/legacy name lookups, ID helpers, normalization, registry
	*   existence checks, and specifier parsing.
	*/
	let builtinSet;
	/**
	* Get `Set` of Node.js built-in module names for O(1) lookups. Derived from
	* the running Node's `builtinModules` (rolldown externalizes builtins, so the
	* CJS dist carries this as a plain `require('node:module')`).
	*/
	function getNpmBuiltinSet() {
		if (builtinSet === void 0) builtinSet = new import_map_set.SetCtor(node_module.builtinModules);
		return builtinSet;
	}
	/**
	* Get `npm` package identifier with optional namespace.
	*/
	function getNpmId(purl) {
		const { name, namespace } = purl;
		return `${namespace && namespace.length > 0 ? `${namespace}/` : ""}${name}`;
	}
	let legacySet;
	/**
	* Get `Set` of `npm` legacy package names for O(1) lookups.
	*/
	function getNpmLegacySet() {
		if (legacySet === void 0) {
			let fullLegacyNames;
			/* v8 ignore start - Fallback path only used if JSON file fails to load. */
			try {
				fullLegacyNames = require_legacy_names();
			} catch {
				fullLegacyNames = [
					"assert",
					"buffer",
					"crypto",
					"events",
					"fs",
					"http",
					"os",
					"path",
					"url",
					"util"
				];
			}
			/* v8 ignore stop */
			legacySet = new import_map_set.SetCtor(fullLegacyNames);
		}
		return legacySet;
	}
	/**
	* Check if `npm` identifier is a Node.js built-in module name.
	*/
	function isNpmBuiltinName(id) {
		return getNpmBuiltinSet().has((0, import_string.StringPrototypeToLowerCase)(id));
	}
	/**
	* Check if `npm` identifier is a legacy package name.
	*/
	function isNpmLegacyName(id) {
		return getNpmLegacySet().has(id);
	}
	/**
	* Normalize `npm` package URL.
	* https://github.com/package-url/purl-spec/blob/main/PURL-TYPES.rst#npm.
	*/
	function normalize$10(purl) {
		lowerNamespace(purl);
		if (!isNpmLegacyName(getNpmId(purl))) lowerName(purl);
		return purl;
	}
	/**
	* Parse npm package specifier into component data.
	*
	* Parses npm package specifiers into `namespace`, `name`, and `version`
	* components. Handles scoped packages, version ranges, and normalizes version
	* strings.
	*
	* **Supported formats:**
	*
	* - Basic packages: `lodash`, `lodash@4.17.21`
	* - Scoped packages: `@babel/core`, `@babel/core@7.0.0`
	* - Version ranges: `^4.17.21`, `~1.2.3`, `>=1.0.0` (prefixes stripped)
	* - Dist-tags: `latest`, `next`, `beta` (passed through as version)
	*
	* **Not supported:**
	*
	* - Git URLs: `git+https://...`
	* - File paths: `file:../package.tgz`
	* - GitHub shortcuts: `user/repo#branch`
	* - Aliases: `npm:package@version`
	*
	* **Note:** Dist-tags like `latest` are mutable and should be resolved to
	* concrete versions for reproducible builds. This method passes them through
	* as-is for convenience.
	*
	* @example
	*   ;```typescript
	*   // Basic packages
	*   parseNpmSpecifier('lodash@4.17.21')
	*   // -> { namespace: undefined, name: 'lodash', version: '4.17.21' }
	*
	*   // Scoped packages
	*   parseNpmSpecifier('@babel/core@^7.0.0')
	*   // -> { namespace: '@babel', name: 'core', version: '7.0.0' }
	*
	*   // Dist-tags (passed through)
	*   parseNpmSpecifier('react@latest')
	*   // -> { namespace: undefined, name: 'react', version: 'latest' }
	*
	*   // No version
	*   parseNpmSpecifier('express')
	*   // -> { namespace: undefined, name: 'express', version: undefined }
	*   ```
	*
	* @param specifier - Npm package specifier (e.g., `'lodash@4.17.21'`,
	*   `'@babel/core@^7.0.0'`)
	*
	* @returns Object with `namespace`, `name`, and `version` components
	*
	* @throws {Error} If `specifier` is not a string or is empty
	*/
	function parseNpmSpecifier(specifier) {
		if (typeof specifier !== "string") throw new import_error.ErrorCtor("npm package specifier string is required.");
		if (isBlank(specifier)) throw new import_error.ErrorCtor("npm package specifier cannot be empty.");
		let namespace;
		let name;
		let version;
		if ((0, import_string.StringPrototypeStartsWith)(specifier, "@")) {
			const slashIndex = (0, import_string.StringPrototypeIndexOf)(specifier, "/");
			if (slashIndex === -1) throw new import_error.ErrorCtor("npm scoped specifier must contain \"/\" after scope (e.g. \"@scope/name\").");
			const atIndex = (0, import_string.StringPrototypeIndexOf)(specifier, "@", slashIndex);
			if (atIndex === -1) {
				namespace = (0, import_string.StringPrototypeSlice)(specifier, 0, slashIndex);
				name = (0, import_string.StringPrototypeSlice)(specifier, slashIndex + 1);
			} else {
				namespace = (0, import_string.StringPrototypeSlice)(specifier, 0, slashIndex);
				name = (0, import_string.StringPrototypeSlice)(specifier, slashIndex + 1, atIndex);
				version = (0, import_string.StringPrototypeSlice)(specifier, atIndex + 1);
			}
		} else {
			const atIndex = (0, import_string.StringPrototypeIndexOf)(specifier, "@");
			if (atIndex === -1) name = specifier;
			else {
				name = (0, import_string.StringPrototypeSlice)(specifier, 0, atIndex);
				version = (0, import_string.StringPrototypeSlice)(specifier, atIndex + 1);
			}
		}
		if (version) {
			version = (0, import_string.StringPrototypeReplace)(version, /^[\^~>=<]+/, "");
			const spaceIndex = (0, import_string.StringPrototypeIndexOf)(version, " ");
			if (spaceIndex !== -1) version = (0, import_string.StringPrototypeSlice)(version, 0, spaceIndex);
		}
		return {
			namespace,
			name,
			version
		};
	}
	/**
	* @file `npm`-specific PURL normalization and validation. Implements npm
	*   package naming rules from the PURL specification.
	*/
	/**
	* Validate `npm` package URL. Validation based on
	* https://github.com/npm/validate-npm-package-name/tree/v6.0.0 ISC License
	* Copyright (c) 2015, npm, Inc.
	*/
	function npmValidate(purl, options) {
		const { throws = false } = options ?? {};
		const { name, namespace } = purl;
		if (!validateNoInjectionByType("npm", "name", name, { throws })) return false;
		if (!validateNoInjectionByType("npm", "namespace", namespace, { throws })) return false;
		const hasNs = namespace && namespace.length > 0;
		const id = getNpmId(purl);
		const code0 = (0, import_string.StringPrototypeCharCodeAt)(id, 0);
		const compName = hasNs ? "namespace" : "name";
		if (code0 === 46) {
			if (throws) throw new PurlError(`npm "${compName}" component cannot start with a period`);
			return false;
		}
		if (code0 === 95) {
			if (throws) throw new PurlError(`npm "${compName}" component cannot start with an underscore`);
			return false;
		}
		/* v8 ignore start -- Unreachable: space chars are caught by injection validator above. */
		if ((0, import_string.StringPrototypeTrim)(name) !== name) {
			if (throws) throw new PurlError("npm \"name\" component cannot contain leading or trailing spaces");
			return false;
		}
		/* v8 ignore stop */
		if (encodeComponent(name) !== name) {
			if (throws) throw new PurlError(`npm "name" component can only contain URL-friendly characters`);
			return false;
		}
		if (hasNs) {
			/* v8 ignore start -- Unreachable: space chars are caught by injection validator above. */
			if ((namespace !== void 0 ? (0, import_string.StringPrototypeTrim)(namespace) : namespace) !== namespace) {
				if (throws) throw new PurlError("npm \"namespace\" component cannot contain leading or trailing spaces");
				return false;
			}
			/* v8 ignore stop */
			if (code0 !== 64) {
				if (throws) throw new PurlError(`npm "namespace" component must start with an "@" character`);
				return false;
			}
			const namespaceWithoutAtSign = (0, import_string.StringPrototypeSlice)(namespace, 1);
			if (encodeComponent(namespaceWithoutAtSign) !== namespaceWithoutAtSign) {
				if (throws) throw new PurlError(`npm "namespace" component can only contain URL-friendly characters`);
				return false;
			}
		}
		const loweredId = (0, import_string.StringPrototypeToLowerCase)(id);
		if (loweredId === "favicon.ico" || loweredId === "node_modules") {
			if (throws) throw new PurlError(`npm "${compName}" component of "${loweredId}" is not allowed`);
			return false;
		}
		if (!isNpmLegacyName(id)) {
			if (id.length > 214) {
				if (throws)
 /* v8 ignore start -- Throw path tested separately from return false path. */
				throw new PurlError(`npm "namespace" and "name" components can not collectively be more than 214 characters`);
				return false;
			}
			if (loweredId !== id) {
				if (throws) throw new PurlError(`npm "name" component can not contain capital letters`);
				return false;
			}
			/* v8 ignore start -- Unreachable: ~'!()* are all injection chars caught by validator above. */
			if ((0, import_regexp.RegExpPrototypeTest)(/[~'!()*]/, name)) {
				if (throws) throw new PurlError(`npm "name" component can not contain special characters ("~'!()*")`);
				return false;
			}
			/* v8 ignore stop */
			if (isNpmBuiltinName(id)) {
				if (throws)
 /* v8 ignore start -- Throw path tested separately from return false path. */
				throw new PurlError("npm \"name\" component can not be a core module name");
				return false;
			}
		}
		return true;
	}
	/**
	* Validate NuGet package URL. NuGet packages must not have a `namespace`.
	* `name` must not contain injection characters.
	*/
	function nugetValidate(purl, options) {
		const { throws = false } = options ?? {};
		if (!validateEmptyByType("nuget", "namespace", purl.namespace, { throws })) return false;
		if (!validateNoInjectionByType("nuget", "name", purl.name, { throws })) return false;
		return true;
	}
	/**
	* @file OCI (Open Container Initiative) PURL normalization and validation.
	*   https://github.com/package-url/purl-spec/blob/main/PURL-TYPES.rst#oci.
	*/
	/**
	* Normalize OCI package URL. Lowercases `name` and `version` per spec.
	*/
	function normalize$9(purl) {
		lowerName(purl);
		lowerVersion(purl);
		return purl;
	}
	/**
	* Validate OCI package URL. OCI packages must not have a `namespace`.
	*/
	function ociValidate(purl, options) {
		const { throws = false } = options ?? {};
		if (!validateEmptyByType("oci", "namespace", purl.namespace, { throws })) return false;
		if (!validateNoInjectionByType("oci", "name", purl.name, { throws })) return false;
		return true;
	}
	/**
	* @file OPAM-specific PURL validation.
	*   https://github.com/package-url/purl-spec/blob/main/PURL-TYPES.rst OPAM is
	*   the OCaml package manager. Package names are lowercase.
	*/
	/**
	* Validate OPAM package URL. OPAM packages must not have a `namespace`.
	*/
	function opamValidate(purl, options) {
		const { throws = false } = options ?? {};
		if (!validateEmptyByType("opam", "namespace", purl.namespace, { throws })) return false;
		if (!validateNoInjectionByType("opam", "name", purl.name, { throws })) return false;
		return true;
	}
	/**
	* @file OTP (Erlang/OTP) PURL normalization and validation.
	*   https://github.com/package-url/purl-spec/blob/main/PURL-TYPES.rst OTP
	*   packages are Erlang/OTP libraries and applications. Package names are
	*   typically lowercase.
	*/
	/**
	* Normalize OTP package URL. Lowercases `name`.
	*/
	function normalize$8(purl) {
		lowerName(purl);
		return purl;
	}
	/**
	* Validate OTP package URL. OTP packages must not have a `namespace`.
	*/
	function otpValidate(purl, options) {
		const { throws = false } = options ?? {};
		if (!validateEmptyByType("otp", "namespace", purl.namespace, { throws })) return false;
		if (!validateNoInjectionByType("otp", "name", purl.name, { throws })) return false;
		return true;
	}
	/**
	* Normalize Pub package URL. Lowercases `name` and replaces dashes with
	* underscores.
	*/
	function normalize$7(purl) {
		lowerName(purl);
		purl.name = replaceDashesWithUnderscores(purl.name);
		return purl;
	}
	/**
	* Validate Pub package URL. `name` may only contain `[a-z0-9_]` characters.
	*/
	function pubValidate(purl, options) {
		const { throws = false } = options ?? {};
		const { name } = purl;
		for (let i = 0, { length } = name; i < length; i += 1) {
			const code = (0, import_string.StringPrototypeCharCodeAt)(name, i);
			if (!(code >= 48 && code <= 57 || code >= 97 && code <= 122 || code === 95)) {
				if (throws)
 /* v8 ignore next 3 -- Throw path tested separately from return false path. */
				throw new PurlError("pub \"name\" component may only contain [a-z0-9_] characters");
				return false;
			}
		}
		return true;
	}
	/**
	* Normalize PyPI package URL. Lowercases `namespace` and `name` and replaces
	* underscores with dashes in `name` (PEP 503). The `version` is preserved: a
	* purl version is an opaque locator with no purl-spec normalization rule, and
	* PEP 440 case-folding is a comparison-layer concern, not canonical form (the
	* packageurl-python reference impl also preserves the pypi version).
	*/
	function normalize$6(purl) {
		lowerNamespace(purl);
		lowerName(purl);
		purl.name = replaceUnderscoresWithDashes(purl.name);
		return purl;
	}
	/**
	* Validate PyPI package URL. `name` must not contain injection characters.
	*/
	function pypiValidate(purl, options) {
		const { throws = false } = options ?? {};
		if (!validateNoInjectionByType("pypi", "name", purl.name, { throws })) return false;
		return true;
	}
	/**
	* @file QPKG (QNAP package) PURL normalization.
	*   https://github.com/package-url/purl-spec/blob/main/PURL-TYPES.rst#qpkg.
	*/
	/**
	* Normalize QPKG package URL. Lowercases `namespace` only.
	*/
	function normalize$5(purl) {
		lowerNamespace(purl);
		return purl;
	}
	/**
	* @file RPM (Red Hat Package Manager) PURL normalization.
	*   https://github.com/package-url/purl-spec/blob/main/PURL-TYPES.rst#rpm.
	*/
	/**
	* Normalize RPM package URL. Lowercases `namespace` only.
	*/
	function normalize$4(purl) {
		lowerNamespace(purl);
		return purl;
	}
	/**
	* Normalize socket package URL. No type-specific normalization for socket
	* packages.
	*/
	function normalize$3(purl) {
		return purl;
	}
	/**
	* @file SWID (Software Identification Tag) PURL validation.
	*   https://github.com/package-url/purl-spec/blob/main/types-doc/swid-definition.md.
	*/
	const GUID_PATTERN = (0, import_object.ObjectFreeze)(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
	/**
	* Validate SWID package URL. SWID requires a `tag_id` qualifier that must not
	* be empty. If `tag_id` is a GUID, it must be lowercase.
	*/
	function swidValidate(purl, options) {
		const { throws = false } = options ?? {};
		const { qualifiers } = purl;
		const tagId = qualifiers?.["tag_id"];
		if (!tagId) {
			if (throws) throw new PurlError("swid requires a \"tag_id\" qualifier");
			return false;
		}
		const tagIdStr = (0, import_string.StringPrototypeTrim)(tagId);
		if (tagIdStr.length === 0) {
			/* v8 ignore next 3 -- Throw path tested separately from return false path. */
			if (throws) throw new PurlError("swid \"tag_id\" qualifier must not be empty");
			return false;
		}
		if ((0, import_regexp.RegExpPrototypeTest)(GUID_PATTERN, tagIdStr)) {
			if (tagIdStr !== (0, import_string.StringPrototypeToLowerCase)(tagIdStr)) {
				if (throws) throw new PurlError("swid \"tag_id\" qualifier must be lowercase when it is a GUID");
				return false;
			}
		}
		if (!validateNoInjectionByType("swid", "name", purl.name, { throws })) return false;
		return true;
	}
	/**
	* @file Swift PURL validation.
	*   https://github.com/package-url/purl-spec/blob/main/PURL-TYPES.rst#swift.
	*/
	/**
	* Validate Swift package URL. Swift packages require both `namespace` and
	* `version`. `name` and `namespace` must not contain injection characters.
	*/
	function swiftValidate(purl, options) {
		const { throws = false } = options ?? {};
		if (!validateRequiredByType("swift", "namespace", purl.namespace, { throws })) return false;
		if (!validateRequiredByType("swift", "version", purl.version, { throws })) return false;
		if (!validateNoInjectionByType("swift", "namespace", purl.namespace, { throws })) return false;
		if (!validateNoInjectionByType("swift", "name", purl.name, { throws })) return false;
		return true;
	}
	/**
	* Normalize unknown package URL. No type-specific normalization for unknown
	* packages.
	*/
	function normalize$2(purl) {
		return purl;
	}
	/**
	* @file Vcpkg (C/C++ package manager) PURL validation.
	*   https://github.com/package-url/purl-spec/blob/main/types/vcpkg-definition.json
	*   A vcpkg port name like `boost-asio` is a single name component — the spec
	*   prohibits a namespace (`pkg:vcpkg/boost/asio` must fail rather than parse
	*   as namespace + name). No normalize step: port names are already lowercase
	*   kebab-case by vcpkg's own registry grammar and the definition carries no
	*   normalization rules. The `port_version` / `repository_revision` / `triplet`
	*   qualifiers are optional and flow through generic qualifier handling.
	*/
	/**
	* Validate vcpkg package URL. Vcpkg packages must not have a `namespace`;
	* `name` must not contain injection characters.
	*/
	function vcpkgValidate(purl, options) {
		const { throws = false } = options ?? {};
		if (!validateEmptyByType("vcpkg", "namespace", purl.namespace, { throws })) return false;
		if (!validateNoInjectionByType("vcpkg", "name", purl.name, { throws })) return false;
		return true;
	}
	/**
	* Normalize VSCode extension package URL. Lowercases `namespace` (publisher),
	* `name` (extension), and `version` per spec. Spec: `namespace`, `name`, and
	* `version` are all case-insensitive.
	*/
	function normalize$1(purl) {
		lowerNamespace(purl);
		lowerName(purl);
		lowerVersion(purl);
		return purl;
	}
	/**
	* Validate VSCode extension package URL. Checks `namespace` (publisher) and
	* `name` (extension) for injection characters, and validates `version` as
	* semver when present.
	*/
	function vscodeExtensionValidate(purl, options) {
		const { throws = false } = options ?? {};
		const { name, namespace, version, qualifiers } = purl;
		if (!validateRequiredByType("vscode-extension", "namespace", namespace, { throws })) return false;
		if (!validateNoInjectionByType("vscode-extension", "namespace", namespace, { throws })) return false;
		if (!validateNoInjectionByType("vscode-extension", "name", name, { throws })) return false;
		if (typeof version === "string" && version.length > 0 && !isSemverString(version)) {
			if (throws) throw new PurlError("vscode-extension \"version\" component must be a valid semver version");
			return false;
		}
		if (!validateNoInjectionByType("vscode-extension", "platform", qualifiers?.["platform"], { throws })) return false;
		return true;
	}
	/**
	* @file Yocto-specific PURL normalization and validation.
	*   https://github.com/package-url/purl-spec/blob/main/PURL-TYPES.rst Yocto
	*   Project packages (recipes) for embedded Linux distributions. The namespace
	*   is the OPTIONAL layer name (BBFILE_COLLECTIONS in the layer's
	*   conf/layer.conf), e.g. `pkg:yocto/core/glibc@2.35`. The purl yocto type
	*   marks the namespace `case_sensitive: false`, so the canonical form
	*   lowercases it. The name (recipe PN/BPN) is `case_sensitive: true` — BitBake
	*   derives it verbatim from the `<name>_<version>.bb` filename, so it is
	*   preserved (lowercase is a dev-manual style convention, not enforced). The
	*   version (PV) is an opaque string and is preserved.
	*/
	/**
	* Normalize Yocto package URL. Lowercases the `namespace` (layer name, which is
	* case-insensitive); preserves `name` (recipe name, case-sensitive) and
	* `version`.
	*/
	function normalize(purl) {
		lowerNamespace(purl);
		return purl;
	}
	/**
	* Validate Yocto package URL. `namespace` (optional layer name) and `name` must
	* not contain injection characters.
	*/
	function yoctoValidate(purl, options) {
		const { throws = false } = options ?? {};
		if (!validateNoInjectionByType("yocto", "namespace", purl.namespace, { throws })) return false;
		if (!validateNoInjectionByType("yocto", "name", purl.name, { throws })) return false;
		return true;
	}
	/**
	* @file Package URL type-specific normalization and validation rules for
	*   different package ecosystems. This module provides centralized access to
	*   type-specific `normalize` and `validate` functions from individual type
	*   modules. Each package ecosystem (`npm`, `pypi`, `maven`, etc.) has its own
	*   module in the `purl-types/` directory with specific rules for `namespace`,
	*   `name`, `version` normalization and validation.
	*/
	/**
	* Default normalizer for PURL types without specific normalization rules.
	*/
	function PurlTypNormalizer(purl) {
		return purl;
	}
	/**
	* Default validator for PURL types without specific validation rules. Rejects
	* injection characters in `name` and `namespace` components. This ensures all
	* types get injection protection by default, and that includes any newly added
	* type — security is opt-out, not opt-in.
	*/
	function PurlTypeValidator(purl, options) {
		const { throws = false } = options ?? {};
		const type = purl.type ?? "unknown";
		if (typeof purl.namespace === "string") {
			const nsCode = findShellInjectionCharCode(purl.namespace);
			if (nsCode !== -1) {
				if (throws) throw new PurlInjectionError(type, "namespace", nsCode, formatInjectionChar(nsCode));
				return false;
			}
		}
		const nameCode = findShellInjectionCharCode(purl.name);
		if (nameCode !== -1) {
			if (throws) throw new PurlInjectionError(type, "name", nameCode, formatInjectionChar(nameCode));
			return false;
		}
		return true;
	}
	const PurlType = createHelpersNamespaceObject({
		normalize: {
			alpm: normalize$27,
			apk: normalize$26,
			bitbucket: normalize$25,
			bitnami: normalize$24,
			"chrome-extension": normalize$23,
			composer: normalize$22,
			conda: normalize$21,
			deb: normalize$20,
			docker: normalize$19,
			generic: normalize$18,
			github: normalize$17,
			gitlab: normalize$16,
			hex: normalize$15,
			huggingface: normalize$14,
			julia: normalize$13,
			luarocks: normalize$12,
			mlflow: normalize$11,
			npm: normalize$10,
			oci: normalize$9,
			otp: normalize$8,
			pub: normalize$7,
			pypi: normalize$6,
			qpkg: normalize$5,
			rpm: normalize$4,
			socket: normalize$3,
			unknown: normalize$2,
			"vscode-extension": normalize$1,
			yocto: normalize
		},
		validate: {
			bazel: bazelValidate,
			bitbucket: bitbucketValidate,
			cargo: cargoValidate,
			"chrome-extension": chromeExtensionValidate,
			cocoapods: cocoaodsValidate,
			conda: condaValidate,
			conan: conanValidate,
			cpan: cpanValidate,
			cran: cranValidate,
			docker: dockerValidate,
			gem: gemValidate,
			github: githubValidate,
			gitlab: gitlabValidate,
			golang: golangValidate,
			hackage: hackageValidate,
			hex: hexValidate,
			julia: juliaValidate,
			maven: mavenValidate,
			mlflow: mlflowValidate,
			npm: npmValidate,
			nuget: nugetValidate,
			oci: ociValidate,
			opam: opamValidate,
			otp: otpValidate,
			pub: pubValidate,
			pypi: pypiValidate,
			swift: swiftValidate,
			swid: swidValidate,
			vcpkg: vcpkgValidate,
			"vscode-extension": vscodeExtensionValidate,
			yocto: yoctoValidate
		}
	}, {
		normalize: PurlTypNormalizer,
		validate: PurlTypeValidator
	});
	/*!
	Copyright (c) the purl authors
	
	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:
	
	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.
	
	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
	*/
	/**
	* Successful result containing a value.
	*/
	var Ok = class Ok {
		kind = "ok";
		value;
		constructor(value) {
			this.value = value;
		}
		/**
		* Chain another result-returning operation.
		*/
		andThen(fn) {
			return fn(this.value);
		}
		/**
		* Check if this result is an error.
		*/
		isErr() {
			return false;
		}
		/**
		* Check if this result is successful.
		*/
		isOk() {
			return true;
		}
		/**
		* Transform the success value.
		*/
		map(fn) {
			return new Ok(fn(this.value));
		}
		/**
		* Transform the error (no-op for `Ok`).
		*/
		mapErr(_fn) {
			return this;
		}
		/**
		* Return this result or the other if error (no-op for `Ok`).
		*/
		orElse(_fn) {
			return this;
		}
		/**
		* Get the success value or throw if error.
		*/
		unwrap() {
			return this.value;
		}
		/**
		* Get the success value or return default if error.
		*/
		unwrapOr(_defaultValue) {
			return this.value;
		}
		/**
		* Get the success value or compute from error if error.
		*/
		unwrapOrElse(_fn) {
			return this.value;
		}
	};
	/**
	* Error result containing an error.
	*/
	var Err = class Err {
		kind = "err";
		error;
		constructor(error) {
			this.error = error;
		}
		/**
		* Chain another result-returning operation (no-op for `Err`).
		*/
		andThen(_fn) {
			return this;
		}
		/**
		* Check if this result is an error.
		*/
		isErr() {
			return true;
		}
		/**
		* Check if this result is successful.
		*/
		isOk() {
			return false;
		}
		/**
		* Transform the success value (no-op for `Err`).
		*/
		map(_fn) {
			return this;
		}
		/**
		* Transform the error.
		*/
		mapErr(fn) {
			return new Err(fn(this.error));
		}
		/**
		* Return this result or the other if error.
		*/
		orElse(fn) {
			return fn(this.error);
		}
		/**
		* Get the success value or throw if error.
		*/
		unwrap() {
			if (this.error instanceof Error) throw this.error;
			throw new import_error.ErrorCtor(String(this.error));
		}
		/**
		* Get the success value or return default if error.
		*/
		unwrapOr(defaultValue) {
			return defaultValue;
		}
		/**
		* Get the success value or compute from error if error.
		*/
		unwrapOrElse(fn) {
			return fn(this.error);
		}
	};
	/**
	* Create an error result.
	*/
	function err(error) {
		return new Err(error);
	}
	/**
	* Create a successful result.
	*/
	function ok(value) {
		return new Ok(value);
	}
	/**
	* Utility functions for working with `PurlResult`s.
	*/
	const ResultUtils = {
		/**
		* Convert all `PurlResult`s to `Ok` values or return first error.
		*/
		all(results) {
			const values = [];
			for (let i = 0; i < results.length; i++) {
				const result = results[i];
				if (result.isErr()) return result;
				(0, import_array.ArrayPrototypePush)(values, result.value);
			}
			return ok(values);
		},
		/**
		* Return the first `Ok` result or the last error. Returns an error result if
		* the input array is empty.
		*/
		any(results) {
			let lastError = err(new import_error.ErrorCtor("No results provided"));
			for (let i = 0, { length } = results; i < length; i += 1) {
				const result = results[i];
				if (result.isOk()) return result;
				lastError = result;
			}
			return lastError;
		},
		/**
		* Create an error result.
		*/
		err,
		/**
		* Wrap a function that might throw into a `PurlResult`.
		*/
		from(fn) {
			try {
				return ok(fn());
			} catch (e) {
				return err(e instanceof Error ? e : new import_error.ErrorCtor(String(e)));
			}
		},
		/**
		* Create a successful result.
		*/
		ok
	};
	/**
	* @file PURL string serialization. Converts `PackageURL` instances to canonical
	*   PURL string format.
	*/
	/**
	* Convert `PackageURL` instance to canonical PURL string.
	*
	* Serializes a `PackageURL` object into its canonical string representation
	* according to the PURL specification.
	*
	* @example
	*   ;```typescript
	*   const purl = new PackageURL('npm', undefined, 'lodash', '4.17.21')
	*   stringify(purl)
	*   // -> 'pkg:npm/lodash@4.17.21'
	*   ```
	*
	* @param purl - `PackageURL` instance to stringify.
	*
	* @returns Canonical PURL string (e.g., `'pkg:npm/lodash@4.17.21'`)
	*/
	function stringify(purl) {
		return `pkg:${isNonEmptyString(purl.type) ? encodeComponent(purl.type) : ""}/${stringifySpec(purl)}`;
	}
	/**
	* Convert `PackageURL` instance to spec string (without scheme and type).
	*
	* Returns the package identity portion:
	* `namespace/name@version?qualifiers#subpath` This is the `purl` equivalent of
	* an npm "spec" — the package identity without the ecosystem prefix.
	*
	* @example
	*   ;```typescript
	*   const purl = new PackageURL('npm', '@babel', 'core', '7.0.0')
	*   stringifySpec(purl)
	*   // -> '%40babel/core@7.0.0'
	*   ```
	*
	* @param purl - `PackageURL` instance to stringify.
	*
	* @returns Spec string (e.g., `'%40babel/core@7.0.0'` for
	*   `pkg:npm/%40babel/core@7.0.0`)
	*/
	function stringifySpec(purl) {
		const { name, namespace, qualifiers, subpath, version } = purl;
		let specStr = "";
		if (isNonEmptyString(namespace)) specStr = `${encodeNamespace(namespace)}/`;
		specStr = `${specStr}${encodeName(name)}`;
		if (isNonEmptyString(version)) specStr = `${specStr}@${encodeVersion(version)}`;
		if (qualifiers) specStr = `${specStr}?${encodeQualifiers(qualifiers)}`;
		if (isNonEmptyString(subpath)) specStr = `${specStr}#${encodeSubpath(subpath)}`;
		return specStr;
	}
	/*!
	Copyright (c) the purl authors
	
	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:
	
	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.
	
	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
	*/
	/**
	* @file URL conversion utilities for converting Package URLs to repository and
	*   download URLs.
	*/
	let cachedPackageURL$1;
	/**
	* @internal Register the `PackageURL` class for `fromUrl` construction.
	*/
	function registerPackageURLForUrlConverter(ctor) {
		cachedPackageURL$1 = ctor;
	}
	/**
	* Filter empty segments from a URL pathname split. Trailing slashes create
	* empty segments that must be removed.
	*/
	function filterSegments(pathname) {
		return (0, import_array.ArrayPrototypeFilter)((0, import_string.StringPrototypeSplit)(pathname, "/"), (s) => s.length > 0);
	}
	/**
	* Safely construct a `PackageURL`, returning `undefined` if construction fails.
	*/
	function tryCreatePurl(type, namespace, name, version) {
		/* v8 ignore start -- PackageURL is always registered at module load time. */
		if (!cachedPackageURL$1) return;
		/* v8 ignore stop */
		try {
			return new cachedPackageURL$1(type, namespace, name, version, void 0, void 0);
		} catch {
			/* v8 ignore start -- Defensive: validation error in PackageURL constructor. */
			return;
		}
	}
	/**
	* Shared semver-ish version capture for distribution-filename parsers. Captures
	* `major[.minor.patch...]` plus optional pre-release / build-metadata tail into
	* a `version` group. Permissive by design — distribution filenames carry more
	* shapes than strict semver (single-segment versions, build metadata with
	* hyphens, etc.).
	*/
	const DIST_VERSION = [
		"(?<version>",
		"\\d+(?:\\.\\d+)*",
		"(?:",
		"(?:-+|\\.)",
		"[a-zA-Z0-9]+",
		"(?:[-.][a-zA-Z0-9]+)*",
		")?",
		"(?:\\+[a-zA-Z0-9.]+)?",
		")"
	].join("");
	/**
	* Extract the pathname from a URL-or-path string. A leading `http://` or
	* `https://` scheme marks a full URL; anything else is treated as a bare path.
	* Detection is by scheme, not a bare `http` prefix — a filename like
	* `httpx-1.0.tar.gz` is a path, not a URL — and a malformed URL falls back to
	* the raw input rather than throwing.
	*/
	function urlOrPathPathname(urlOrPath) {
		if ((0, import_string.StringPrototypeStartsWith)(urlOrPath, "http://") || (0, import_string.StringPrototypeStartsWith)(urlOrPath, "https://")) try {
			return new import_url.URLCtor(urlOrPath).pathname;
		} catch {
			/* v8 ignore next -- Defensive: a scheme-prefixed string that still fails URL parsing. */
			return urlOrPath;
		}
		return urlOrPath;
	}
	const MAX_DISTRIBUTION_FILENAME_LENGTH = 4096;
	/**
	* Strip a URL or path down to its final filename segment. Distribution parsers
	* match against the bare filename, so a full URL and a bare path resolve
	* identically.
	*
	* Returns an empty string when the resolved filename exceeds
	* {@link MAX_DISTRIBUTION_FILENAME_LENGTH}, so the downstream filename regexes
	* never run on a pathological input (ReDoS guard). An empty string fails every
	* filename pattern, which the callers already treat as "not a distribution
	* URL".
	*/
	function distributionFilename(urlOrPath) {
		const pathname = urlOrPathPathname(urlOrPath);
		const segments = filterSegments(pathname);
		const filename = segments.length ? segments[segments.length - 1] : pathname;
		return filename.length > MAX_DISTRIBUTION_FILENAME_LENGTH ? "" : filename;
	}
	/**
	* Run a `URL`-taking parser against a URL string, parsing the string first and
	* returning `undefined` if it isn't a valid URL. Lets the public static methods
	* accept strings while the internal parsers keep their `URL` signatures.
	*/
	function runUrlParser(parser, urlStr) {
		let url;
		try {
			url = new import_url.URLCtor(urlStr);
		} catch {
			return;
		}
		return parser(url);
	}
	/**
	* Resolve a tarball segment's version, tolerating both the bare `name-` prefix
	* and the proxy/mirror `@scope/name-` (full scoped name) prefix that some
	* registries (Artifactory, Nexus, Verdaccio, GitHub Packages) repeat in the
	* filename. Returns the version string, or `undefined` if the segment is not a
	* recognizable `<prefix>-<version>.tgz`.
	*/
	function npmTarballVersion(tgz, name, namespace) {
		if (!(0, import_string.StringPrototypeEndsWith)(tgz, ".tgz")) return;
		const withoutExt = (0, import_string.StringPrototypeSlice)(tgz, 0, -4);
		if (namespace) {
			const scopedPrefix = `${namespace}/${name}-`;
			if ((0, import_string.StringPrototypeStartsWith)(withoutExt, scopedPrefix)) return (0, import_string.StringPrototypeSlice)(withoutExt, scopedPrefix.length);
		}
		const prefix = `${name}-`;
		if ((0, import_string.StringPrototypeStartsWith)(withoutExt, prefix)) return (0, import_string.StringPrototypeSlice)(withoutExt, prefix.length);
	}
	/**
	* Parse npm registry URLs (`registry.npmjs.org`).
	*
	* Handles:
	*
	* - Registry metadata: `/\@scope/name` or `/name`
	* - Registry metadata with version: `/\@scope/name/version` or `/name/version`
	* - Download tarballs: `/\@scope/name/-/name-version.tgz` or
	*   `/name/-/name-version.tgz`
	* - Proxy/mirror tarballs that repeat the scoped name
	*   (`/\@scope/name/-/\@scope/name-version.tgz`) and `%2f`-encoded scope
	*   separators that yarn and some registries emit.
	*/
	function fromNpmRegistryUrl(url) {
		const segments = filterSegments((0, import_string.StringPrototypeReplace)(url.pathname, /%2f/gi, "/"));
		if (segments.length === 0) return;
		let namespace;
		let name;
		let version;
		if (segments[0] && (0, import_string.StringPrototypeStartsWith)(segments[0], "@")) {
			namespace = segments[0];
			name = segments[1];
			if (!name) return;
			if (segments[2] === "-" && segments[3]) version = npmTarballVersion(segments[3] && (0, import_string.StringPrototypeStartsWith)(segments[3], "@") && segments[4] ? `${segments[3]}/${segments[4]}` : segments[3], name, namespace);
			else if (segments[2]) version = segments[2];
		} else {
			name = segments[0];
			/* v8 ignore start -- Defensive: filterSegments ensures non-empty. */
			if (!name) return;
			/* v8 ignore stop */
			if (segments[1] === "-" && segments[2]) version = npmTarballVersion(segments[2], name, void 0);
			else if (segments[1]) version = segments[1];
		}
		return tryCreatePurl("npm", namespace, name, version);
	}
	/**
	* Parse npm website URLs (`www.npmjs.com`).
	*
	* Handles:
	*
	* - `/package/\@scope/name`, `/package/\@scope/name/v/version`
	* - `/package/name`, `/package/name/v/version`
	*/
	function fromNpmSiteUrl(url) {
		const segments = filterSegments(url.pathname);
		if (segments.length === 0 || segments[0] !== "package") return;
		let namespace;
		let name;
		let version;
		if (segments[1] && (0, import_string.StringPrototypeStartsWith)(segments[1], "@")) {
			namespace = segments[1];
			name = segments[2];
			if (!name) return;
			if (segments[3] === "v" && segments[4]) version = segments[4];
		} else {
			name = segments[1];
			if (!name) return;
			if (segments[2] === "v" && segments[3]) version = segments[3];
		}
		return tryCreatePurl("npm", namespace, name, version);
	}
	/**
	* Parse any recognized npm URL. npm's two shapes are distinguished by hostname,
	* not path shape (`registry.npmjs.org` serves metadata / tarballs;
	* `www.npmjs.com` serves package pages), so dispatch by host — the registry
	* parser is greedy enough to misread a website path if tried blindly.
	*/
	function fromNpmUrl(url) {
		if (url.hostname === "www.npmjs.com") return fromNpmSiteUrl(url);
		return fromNpmRegistryUrl(url);
	}
	/**
	* Parse PyPI URLs (`pypi.org`).
	*
	* Handles: `/project/name/`, `/project/name/version/`
	*/
	function fromPypiSiteUrl(url) {
		const segments = filterSegments(url.pathname);
		if (segments.length < 2 || segments[0] !== "project") return;
		const name = segments[1];
		/* v8 ignore start -- Defensive: filterSegments ensures non-empty. */
		if (!name) return;
		/* v8 ignore stop */
		const version = segments[2];
		return tryCreatePurl("pypi", void 0, name, version);
	}
	/**
	* PyPI wheel / sdist distribution filename matcher. Captures `name` + `version`
	* from filenames like `orjson-3.11.9-cp314-cp314-manylinux_2_17_x86_64.whl`,
	* tolerating PEP 427 compound platform tags that contain dots
	* (`manylinux_2_17_x86_64.manylinux2014_x86_64`), an optional epoch (`3!1.0`),
	* and an optional trailing `.metadata` suffix.
	*/
	const PYPI_FILENAME = new RegExp([
		"^",
		"(?<name>[a-zA-Z0-9._-]+?)",
		"-",
		"(?<epoch>\\d+!)?",
		"(?=\\d)",
		DIST_VERSION,
		"(?:-[^.]+(?:\\.[^.]+)*)?",
		"\\.",
		"(?:whl|tar\\.gz|zip)",
		"(?:\\.metadata)?",
		"$"
	].join(""));
	/**
	* Parse a PyPI distribution URL or path (a wheel / sdist filename) into a
	* `PackageURL`. Works on a bare path or a full URL.
	*
	* Handles: `…/orjson-3.11.9-cp314-…-manylinux….whl`,
	* `…/package-name-1.0.0.tar.gz`, `…/package-name-1.0.0.zip`, optionally with a
	* trailing `.metadata`.
	*/
	function fromPypiDownloadUrl(urlOrPath) {
		const filename = distributionFilename(urlOrPath);
		const match = (0, import_regexp.RegExpPrototypeExec)(PYPI_FILENAME, filename);
		if (!match?.groups) return;
		const { epoch, name } = match.groups;
		/* v8 ignore start -- DIST_VERSION always captures a version group on a match. */
		if (!name || !match.groups["version"]) return;
		/* v8 ignore stop */
		const base = (0, import_string.StringPrototypeSplit)(match.groups["version"], "-")[0];
		return tryCreatePurl("pypi", void 0, name, epoch ? `${epoch}${base}` : base);
	}
	/**
	* Parse any recognized PyPI URL — project page (`pypi.org/project/…`) or a
	* distribution filename (wheel / sdist). Project-page parsing wins; the
	* distribution parser is the fallback.
	*/
	function fromPypiUrl(url) {
		return fromPypiSiteUrl(url) ?? fromPypiDownloadUrl(url.href);
	}
	/**
	* Parse Maven Central URLs (`repo1.maven.org`).
	*
	* Handles: `/maven2/{group-as-path}/{artifact}/{version}/` Group path segments
	* are joined with `'.'`.
	*/
	function fromMavenSiteUrl(url) {
		const segments = filterSegments(url.pathname);
		if (segments.length < 4 || segments[0] !== "maven2") return;
		const parts = (0, import_array.ArrayPrototypeSlice)(segments, 1);
		/* v8 ignore start -- Defensive: the length>=4 guard above ensures parts>=3. */
		if (parts.length < 3) return;
		/* v8 ignore stop */
		const version = parts[parts.length - 1];
		const name = parts[parts.length - 2];
		const namespace = (0, import_array.ArrayPrototypeJoin)((0, import_array.ArrayPrototypeSlice)(parts, 0, -2), ".");
		/* v8 ignore start -- Defensive: filterSegments yields non-empty segments. */
		if (!namespace || !name) return;
		/* v8 ignore stop */
		return tryCreatePurl("maven", namespace, name, version);
	}
	/**
	* Parse RubyGems URLs (`rubygems.org`).
	*
	* Handles: `/gems/name`, `/gems/name/versions/version`
	*/
	function fromGemSiteUrl(url) {
		const segments = filterSegments(url.pathname);
		if (segments.length < 2 || segments[0] !== "gems") return;
		const name = segments[1];
		/* v8 ignore start -- Defensive: filterSegments ensures non-empty. */
		if (!name) return;
		/* v8 ignore stop */
		let version;
		if (segments[2] === "versions" && segments[3]) version = segments[3];
		return tryCreatePurl("gem", void 0, name, version);
	}
	/**
	* RubyGems distribution filename matchers. A direct `.gem`
	* (`/gems/name-1.2.3.gem`) and a `.gemspec.rz` under the `/quick/Marshal.x/`
	* tree, which `gem` requests over the proxy even when it bypasses the proxy for
	* the gem file itself.
	*/
	const GEM_FILENAME = new RegExp([
		"^",
		"(?<name>[a-zA-Z0-9_-]+?)",
		"-",
		DIST_VERSION,
		"\\.gem$"
	].join(""));
	const GEMSPEC_FILENAME = new RegExp([
		"^",
		"(?<name>[a-zA-Z0-9_-]+?)",
		"-",
		DIST_VERSION,
		"\\.gemspec\\.rz$"
	].join(""));
	/**
	* Parse a RubyGems distribution URL or path (`…/name-1.2.3.gem` or a
	* `…/name-1.2.3.gemspec.rz`) into a `PackageURL`.
	*/
	function fromGemDownloadUrl(urlOrPath) {
		const filename = distributionFilename(urlOrPath);
		const match = (0, import_regexp.RegExpPrototypeExec)(GEM_FILENAME, filename) ?? (0, import_regexp.RegExpPrototypeExec)(GEMSPEC_FILENAME, filename);
		if (!match?.groups?.["name"] || !match.groups["version"]) return;
		return tryCreatePurl("gem", void 0, match.groups["name"], match.groups["version"]);
	}
	/**
	* Parse any recognized RubyGems URL — gems.org web page or a distribution
	* filename. Web-page parsing wins; the distribution parser is the fallback.
	*/
	function fromGemUrl(url) {
		return fromGemSiteUrl(url) ?? fromGemDownloadUrl(url.href);
	}
	/**
	* Parse `crates.io` URLs.
	*
	* Handles: - `/crates/name`, `/crates/name/version` -
	* `/api/v1/crates/name/version/download`
	*/
	function fromCargoSiteUrl(url) {
		const segments = filterSegments(url.pathname);
		if (segments.length < 2) return;
		if (segments[0] === "api" && segments[1] === "v1" && segments[2] === "crates" && segments[3]) {
			const name = segments[3];
			const version = segments[4];
			return tryCreatePurl("cargo", void 0, name, version);
		}
		if (segments[0] !== "crates") return;
		const name = segments[1];
		/* v8 ignore start -- Defensive: filterSegments ensures non-empty. */
		if (!name) return;
		/* v8 ignore stop */
		const version = segments[2];
		return tryCreatePurl("cargo", void 0, name, version);
	}
	/**
	* Parse a crates.io download path (`/crates/name/version/download`) into a
	* `PackageURL`. The site parser handles this shape when the `crates.io`
	* hostname is present; this covers the same path arriving without a host (e.g.
	* a proxy observing the bare request path).
	*/
	function fromCargoDownloadUrl(urlOrPath) {
		const segments = filterSegments(urlOrPathPathname(urlOrPath));
		if (segments.length === 4 && segments[0] === "crates" && segments[3] === "download") return tryCreatePurl("cargo", void 0, segments[1], segments[2]);
	}
	/**
	* Parse NuGet URLs (`www.nuget.org` and `api.nuget.org`).
	*
	* Handles: - `www.nuget.org`: `/packages/Name`, `/packages/Name/version` -
	* `api.nuget.org`: `/v3-flatcontainer/name/version/name.version.nupkg`
	*/
	function fromNugetSiteUrl(url) {
		const segments = filterSegments(url.pathname);
		if (segments.length < 2) return;
		if (url.hostname === "api.nuget.org") {
			if (segments[0] !== "v3-flatcontainer" || !segments[1]) return;
			const name = segments[1];
			const version = segments[2];
			return tryCreatePurl("nuget", void 0, name, version);
		}
		if (segments[0] !== "packages") return;
		const name = segments[1];
		/* v8 ignore start -- Defensive: filterSegments ensures non-empty. */
		if (!name) return;
		/* v8 ignore stop */
		const version = segments[2];
		return tryCreatePurl("nuget", void 0, name, version);
	}
	/**
	* Parse GitHub URLs (`github.com`).
	*
	* Handles: - `/owner/repo` - `/owner/repo/tree/ref` - `/owner/repo/commit/sha`
	* - `/owner/repo/releases/tag/tagname`
	*/
	function fromGitHubUrl(url) {
		const segments = filterSegments(url.pathname);
		if (segments.length < 2) return;
		const namespace = segments[0];
		const name = segments[1];
		let version;
		if (segments[2] === "tree" && segments[3]) version = segments[3];
		else if (segments[2] === "commit" && segments[3]) version = segments[3];
		else if (segments[2] === "releases" && segments[3] === "tag" && segments[4]) version = segments[4];
		return tryCreatePurl("github", namespace, name, version);
	}
	/**
	* Parse Go package URLs (`pkg.go.dev`).
	*
	* Handles:
	*
	* - `/module/path` (e.g. `/github.com/gorilla/mux`)
	* - `/module/path\@version` (e.g. `/github.com/gorilla/mux\@v1.8.0`)
	*/
	function fromGolangSiteUrl(url) {
		let path = (0, import_string.StringPrototypeSlice)(url.pathname, 1);
		if (!path) return;
		let version;
		const atIndex = (0, import_string.StringPrototypeLastIndexOf)(path, "@");
		if (atIndex !== -1) {
			version = (0, import_string.StringPrototypeSlice)(path, atIndex + 1);
			path = (0, import_string.StringPrototypeSlice)(path, 0, atIndex);
		}
		const lastSlash = (0, import_string.StringPrototypeLastIndexOf)(path, "/");
		if (lastSlash === -1) return;
		const namespace = (0, import_string.StringPrototypeSlice)(path, 0, lastSlash);
		const name = (0, import_string.StringPrototypeSlice)(path, lastSlash + 1);
		if (!namespace || !name)
 /* v8 ignore start -- Defensive: filterSegments ensures non-empty. */
		return;
		return tryCreatePurl("golang", namespace, name, version);
	}
	/**
	* Go module proxy download matcher:
	* `/<module-path>/@v/<version>.(zip|mod|info)`. The module path may contain
	* slashes (`github.com/gorilla/mux`); the final segment is the package name,
	* the rest is the namespace. The `v` prefix is part of the captured version.
	*/
	const GOLANG_PROXY = new RegExp([
		"^/?",
		"(?<modulePath>[^@]+?)",
		"/@v/",
		"(?<version>v[^/]+?)",
		"\\.(?:zip|mod|info)",
		"$"
	].join(""));
	/**
	* Parse a Go module proxy download URL or path
	* (`…/github.com/gorilla/mux/@v/v1.8.0.zip`) into a `PackageURL`.
	*/
	function fromGolangDownloadUrl(urlOrPath) {
		const pathname = urlOrPathPathname(urlOrPath);
		const match = (0, import_regexp.RegExpPrototypeExec)(GOLANG_PROXY, pathname);
		if (!match?.groups?.["modulePath"] || !match.groups["version"]) return;
		const modulePath = match.groups["modulePath"];
		const lastSlash = (0, import_string.StringPrototypeLastIndexOf)(modulePath, "/");
		if (lastSlash === -1) return;
		const version = match.groups["version"];
		const namespace = (0, import_string.StringPrototypeSlice)(modulePath, 0, lastSlash);
		const name = (0, import_string.StringPrototypeSlice)(modulePath, lastSlash + 1);
		if (!namespace || !name) return;
		return tryCreatePurl("golang", decodeGolangProxyPath(namespace), decodeGolangProxyPath(name), decodeGolangProxyPath(version));
	}
	/**
	* Parse any recognized Go URL — pkg.go.dev page or a module-proxy download.
	* Page parsing wins; the download parser is the fallback.
	*/
	function fromGolangUrl(url) {
		return fromGolangSiteUrl(url) ?? fromGolangDownloadUrl(url.href);
	}
	/**
	* Parse GitLab URLs (`gitlab.com`). Same pattern as GitHub: `/owner/repo`,
	* `/owner/repo/-/tree/ref`, `/owner/repo/-/commit/sha`
	*/
	function fromGitlabUrl(url) {
		const segments = filterSegments(url.pathname);
		if (segments.length < 2) return;
		const namespace = segments[0];
		const name = segments[1];
		let version;
		if (segments[2] === "-") {
			if (segments[3] === "tree" && segments[4]) version = segments[4];
			else if (segments[3] === "commit" && segments[4]) version = segments[4];
			else if (segments[3] === "tags" && segments[4]) version = segments[4];
		}
		return tryCreatePurl("gitlab", namespace, name, version);
	}
	/**
	* Parse Bitbucket URLs (`bitbucket.org`). Pattern: `/owner/repo`,
	* `/owner/repo/commits/sha`, `/owner/repo/src/ref`
	*/
	function fromBitbucketUrl(url) {
		const segments = filterSegments(url.pathname);
		if (segments.length < 2) return;
		const namespace = segments[0];
		const name = segments[1];
		let version;
		if (segments[2] === "commits" && segments[3]) version = segments[3];
		else if (segments[2] === "src" && segments[3]) version = segments[3];
		return tryCreatePurl("bitbucket", namespace, name, version);
	}
	/**
	* Parse Packagist/Composer URLs (`packagist.org`). Pattern:
	* `/packages/namespace/name`
	*/
	function fromComposerUrl(url) {
		const segments = filterSegments(url.pathname);
		if (segments.length < 3 || segments[0] !== "packages") return;
		const namespace = segments[1];
		const name = segments[2];
		return tryCreatePurl("composer", namespace, name, void 0);
	}
	/**
	* Parse Hex.pm URLs (`hex.pm`). Pattern: `/packages/name`,
	* `/packages/name/version`
	*/
	function fromHexUrl(url) {
		const segments = filterSegments(url.pathname);
		if (segments.length < 2 || segments[0] !== "packages") return;
		const name = segments[1];
		const version = segments[2];
		return tryCreatePurl("hex", void 0, name, version);
	}
	/**
	* Parse pub.dev URLs (`pub.dev`). Pattern: `/packages/name`,
	* `/packages/name/versions/version`
	*/
	function fromPubUrl(url) {
		const segments = filterSegments(url.pathname);
		if (segments.length < 2 || segments[0] !== "packages") return;
		const name = segments[1];
		let version;
		if (segments[2] === "versions" && segments[3]) version = segments[3];
		return tryCreatePurl("pub", void 0, name, version);
	}
	/**
	* Parse Docker Hub URLs (`hub.docker.com`). Patterns:
	*
	* - Official images: `/\_/name`
	* - User images: `/r/namespace/name`
	* - Library alias: `/r/library/name`
	*/
	function fromDockerUrl(url) {
		const segments = filterSegments(url.pathname);
		if (segments.length < 2) return;
		if (segments[0] === "_" && segments[1]) return tryCreatePurl("docker", "library", segments[1], void 0);
		if (segments[0] === "r" && segments[1] && segments[2]) return tryCreatePurl("docker", segments[1], segments[2], void 0);
	}
	/**
	* Parse CocoaPods URLs (`cocoapods.org`). Pattern: `/pods/name`
	*/
	function fromCocoapodsUrl(url) {
		const segments = filterSegments(url.pathname);
		if (segments.length < 2 || segments[0] !== "pods") return;
		return tryCreatePurl("cocoapods", void 0, segments[1], void 0);
	}
	/**
	* Parse Hackage URLs (`hackage.haskell.org`). Pattern: `/package/name`,
	* `/package/name-version`
	*/
	function fromHackageUrl(url) {
		const segments = filterSegments(url.pathname);
		if (segments.length < 2 || segments[0] !== "package") return;
		const raw = segments[1];
		let splitIndex = -1;
		for (let i = raw.length - 1; i >= 0; i -= 1) if ((0, import_string.StringPrototypeCharCodeAt)(raw, i) === 45) {
			const next = (0, import_string.StringPrototypeCharCodeAt)(raw, i + 1);
			if (next >= 48 && next <= 57) {
				splitIndex = i;
				break;
			}
		}
		if (splitIndex === -1) return tryCreatePurl("hackage", void 0, raw, void 0);
		return tryCreatePurl("hackage", void 0, (0, import_string.StringPrototypeSlice)(raw, 0, splitIndex), (0, import_string.StringPrototypeSlice)(raw, splitIndex + 1));
	}
	/**
	* Parse CRAN URLs (`cran.r-project.org`). Pattern: `/web/packages/name`,
	* `/package=name` (query param)
	*/
	function fromCranUrl(url) {
		const segments = filterSegments(url.pathname);
		if (segments.length >= 3 && segments[0] === "web" && segments[1] === "packages") {
			const version = segments[3] && segments[3] !== "index.html" ? segments[3] : void 0;
			return tryCreatePurl("cran", void 0, segments[2], version);
		}
	}
	/**
	* Parse Anaconda/Conda URLs (`anaconda.org`). Pattern: `/channel/name`,
	* `/channel/name/version`
	*/
	function fromCondaUrl(url) {
		const segments = filterSegments(url.pathname);
		if (segments.length < 2) return;
		const name = segments[1];
		const version = segments[2];
		return tryCreatePurl("conda", void 0, name, version);
	}
	/**
	* Parse MetaCPAN URLs (`metacpan.org`). Pattern:
	* `/release/AUTHOR/Dist-Name-1.23` — the only MetaCPAN page shape that carries
	* the author id a cpan purl requires as its namespace. Authorless `/pod/` and
	* `/dist/` pages cannot become spec-valid cpan purls.
	*/
	function fromCpanUrl(url) {
		const segments = filterSegments(url.pathname);
		if (segments.length < 3 || segments[0] !== "release") return;
		const author = segments[1];
		const distWithVersion = segments[2];
		const dashIndex = (0, import_string.StringPrototypeLastIndexOf)(distWithVersion, "-");
		if (dashIndex < 1) return tryCreatePurl("cpan", author, distWithVersion, void 0);
		return tryCreatePurl("cpan", author, (0, import_string.StringPrototypeSlice)(distWithVersion, 0, dashIndex), (0, import_string.StringPrototypeSlice)(distWithVersion, dashIndex + 1));
	}
	/**
	* Parse Hugging Face URLs (`huggingface.co`). Pattern: `/namespace/name`,
	* `/namespace/name/tree/ref`
	*/
	/**
	* Reserved Hugging Face paths that are not model pages.
	*/
	const HUGGINGFACE_RESERVED = (0, import_object.ObjectFreeze)(new import_map_set.SetCtor([
		"docs",
		"spaces",
		"datasets",
		"tasks",
		"blog",
		"pricing",
		"join",
		"login",
		"settings",
		"api"
	]));
	function fromHuggingfaceUrl(url) {
		const segments = filterSegments(url.pathname);
		if (segments.length < 2) return;
		if (HUGGINGFACE_RESERVED.has(segments[0])) return;
		const namespace = segments[0];
		const name = segments[1];
		let version;
		if (segments[2] === "tree" && segments[3]) version = segments[3];
		else if (segments[2] === "commit" && segments[3]) version = segments[3];
		return tryCreatePurl("huggingface", namespace, name, version);
	}
	/**
	* Parse LuaRocks URLs (`luarocks.org`). Pattern: `/modules/namespace/name`,
	* `/modules/namespace/name/version`
	*/
	function fromLuarocksUrl(url) {
		const segments = filterSegments(url.pathname);
		if (segments.length < 3 || segments[0] !== "modules") return;
		const namespace = segments[1];
		const name = segments[2];
		const version = segments[3];
		return tryCreatePurl("luarocks", namespace, name, version);
	}
	/**
	* Parse Swift Package Index URLs (`swiftpackageindex.com`). Pattern:
	* `/owner/repo`
	*/
	function fromSwiftUrl(url) {
		const segments = filterSegments(url.pathname);
		if (segments.length < 2) return;
		return tryCreatePurl("swift", segments[0], segments[1], segments[2]);
	}
	/**
	* Parse VS Code Marketplace URLs (`marketplace.visualstudio.com`). Pattern:
	* `/items?itemName=publisher.extension`
	*/
	function fromVscodeMarketplaceUrl(url) {
		const segments = filterSegments(url.pathname);
		if (segments.length < 1 || segments[0] !== "items") return;
		const itemName = url.searchParams.get("itemName");
		if (!itemName) return;
		const dotIndex = (0, import_string.StringPrototypeIndexOf)(itemName, ".");
		if (dotIndex === -1 || dotIndex === 0 || dotIndex === itemName.length - 1) return;
		return tryCreatePurl("vscode-extension", (0, import_string.StringPrototypeSlice)(itemName, 0, dotIndex), (0, import_string.StringPrototypeSlice)(itemName, dotIndex + 1), void 0);
	}
	/**
	* Parse Open VSX URLs (`open-vsx.org`). Pattern: `/extension/namespace/name`,
	* `/extension/namespace/name/version`
	*/
	function fromOpenVsxUrl(url) {
		const segments = filterSegments(url.pathname);
		if (segments.length < 3 || segments[0] !== "extension") return;
		const namespace = segments[1];
		const name = segments[2];
		const version = segments[3];
		return tryCreatePurl("vscode-extension", namespace, name, version);
	}
	/**
	* Hostname-based dispatch map for URL-to-PURL parsing.
	*/
	const FROM_URL_PARSERS = (0, import_object.ObjectFreeze)(new import_map_set.MapCtor([
		["registry.npmjs.org", fromNpmRegistryUrl],
		["www.npmjs.com", fromNpmSiteUrl],
		["pypi.org", fromPypiUrl],
		["repo1.maven.org", fromMavenSiteUrl],
		["central.maven.org", fromMavenSiteUrl],
		["rubygems.org", fromGemUrl],
		["crates.io", fromCargoSiteUrl],
		["www.nuget.org", fromNugetSiteUrl],
		["api.nuget.org", fromNugetSiteUrl],
		["pkg.go.dev", fromGolangUrl],
		["hex.pm", fromHexUrl],
		["pub.dev", fromPubUrl],
		["packagist.org", fromComposerUrl],
		["hub.docker.com", fromDockerUrl],
		["cocoapods.org", fromCocoapodsUrl],
		["hackage.haskell.org", fromHackageUrl],
		["cran.r-project.org", fromCranUrl],
		["anaconda.org", fromCondaUrl],
		["metacpan.org", fromCpanUrl],
		["luarocks.org", fromLuarocksUrl],
		["swiftpackageindex.com", fromSwiftUrl],
		["huggingface.co", fromHuggingfaceUrl],
		["marketplace.visualstudio.com", fromVscodeMarketplaceUrl],
		["open-vsx.org", fromOpenVsxUrl],
		["github.com", fromGitHubUrl],
		["gitlab.com", fromGitlabUrl],
		["bitbucket.org", fromBitbucketUrl]
	]));
	/**
	* URL conversion utilities for Package URLs.
	*
	* This class provides static methods for converting `PackageURL` instances into
	* various types of URLs, including repository URLs for source code access and
	* download URLs for package artifacts. It supports many popular package
	* ecosystems.
	*
	* @example
	*   ;```typescript
	*   const purl = PackageURL.fromString('pkg:npm/lodash@4.17.21')
	*   const repoUrl = UrlConverter.toRepositoryUrl(purl)
	*   const downloadUrl = UrlConverter.toDownloadUrl(purl)
	*   ```
	*/
	const DOWNLOAD_URL_TYPES = (0, import_object.ObjectFreeze)(new import_map_set.SetCtor([
		"cargo",
		"composer",
		"conda",
		"gem",
		"golang",
		"hex",
		"maven",
		"npm",
		"nuget",
		"pub",
		"pypi"
	]));
	const REPOSITORY_URL_TYPES = (0, import_object.ObjectFreeze)(new import_map_set.SetCtor([
		"bioconductor",
		"bitbucket",
		"cargo",
		"chrome",
		"clojars",
		"cocoapods",
		"composer",
		"conan",
		"conda",
		"cpan",
		"deno",
		"docker",
		"elm",
		"gem",
		"github",
		"gitlab",
		"golang",
		"hackage",
		"hex",
		"homebrew",
		"huggingface",
		"luarocks",
		"maven",
		"npm",
		"nuget",
		"pub",
		"pypi",
		"swift",
		"vscode"
	]));
	/**
	* Distribution-filename parsers, tried in order by `fromDownloadUrl`. Each
	* takes a bare path or full URL and returns a `PackageURL` only when the
	* filename shape matches its ecosystem.
	*/
	const FROM_DOWNLOAD_URL_PARSERS = (0, import_object.ObjectFreeze)([
		fromPypiDownloadUrl,
		fromGemDownloadUrl,
		fromGolangDownloadUrl,
		fromCargoDownloadUrl
	]);
	/**
	* Parse a package distribution URL or path into a `PackageURL`, trying each
	* ecosystem's distribution parser in turn. Such a path is a registry artifact
	* filename, so this works on a bare path
	* (`/packages/orjson-3.11.9-…-manylinux….whl`) or a full URL.
	*/
	function fromDownloadUrl(urlOrPath) {
		for (let i = 0, { length } = FROM_DOWNLOAD_URL_PARSERS; i < length; i += 1) {
			const result = FROM_DOWNLOAD_URL_PARSERS[i](urlOrPath);
			if (result) return result;
		}
	}
	var UrlConverter = class UrlConverter {
		/**
		* Convert a URL string to a `PackageURL` if the URL is recognized.
		*
		* Dispatches first by hostname (registry / web-page parsers). When no
		* hostname parser matches — an unmapped host, or a bare path with no usable
		* host — falls back to distribution-filename parsing (wheels, tarballs,
		* `.nupkg`, etc.). Hostname dispatch always wins; distribution parsing only
		* adds coverage for inputs the hostname map rejects. Returns `undefined` when
		* neither recognizes the input.
		*
		* @example
		*   ;```typescript
		*   UrlConverter.fromUrl('https://www.npmjs.com/package/lodash')
		*   // -> PackageURL for pkg:npm/lodash
		*
		*   UrlConverter.fromUrl('https://github.com/lodash/lodash')
		*   // -> PackageURL for pkg:github/lodash/lodash
		*
		*   UrlConverter.fromUrl('/packages/orjson-3.11.9-cp314-cp314-manylinux_2_17_x86_64.whl')
		*   // -> PackageURL for pkg:pypi/orjson@3.11.9 (distribution fallback)
		*   ```
		*/
		static fromUrl(urlStr) {
			let url;
			try {
				url = new import_url.URLCtor(urlStr);
			} catch {
				return fromDownloadUrl(urlStr);
			}
			return FROM_URL_PARSERS.get(url.hostname)?.(url) ?? fromDownloadUrl(urlStr);
		}
		/**
		* Check if a URL string is recognized for conversion to a `PackageURL`.
		*
		* Returns `true` if the URL's hostname has a registered parser or the input
		* parses as a distribution filename, `false` otherwise.
		*/
		static supportsFromUrl(urlStr) {
			return UrlConverter.fromUrl(urlStr) !== void 0;
		}
		/**
		* Parse a package distribution (download) URL or bare path — a registry
		* artifact filename such as a wheel, sdist, tarball, gem, `.nupkg`, or Go
		* module-proxy archive — into a `PackageURL`. Unlike {@link fromUrl} this does
		* not require a recognized hostname; it matches on the filename shape, so a
		* bare path resolves identically to a full URL.
		*/
		static fromDownloadUrl(urlOrPath) {
			return fromDownloadUrl(urlOrPath);
		}
		/**
		* Parse any recognized npm URL (registry metadata, tarball, or
		* `www.npmjs.com` page).
		*/
		static fromNpmUrl(urlStr) {
			return runUrlParser(fromNpmUrl, urlStr);
		}
		/**
		* Parse any recognized PyPI URL — project page or a wheel / sdist
		* distribution filename (URL or bare path).
		*/
		static fromPypiUrl(urlStr) {
			return runUrlParser(fromPypiSiteUrl, urlStr) ?? fromPypiDownloadUrl(urlStr);
		}
		/**
		* Parse any recognized RubyGems URL — gem page or a `.gem` / `.gemspec.rz`
		* distribution filename (URL or bare path).
		*/
		static fromGemUrl(urlStr) {
			return runUrlParser(fromGemSiteUrl, urlStr) ?? fromGemDownloadUrl(urlStr);
		}
		/**
		* Parse any recognized Go URL — `pkg.go.dev` page or a module-proxy download
		* (URL or bare path).
		*/
		static fromGolangUrl(urlStr) {
			return runUrlParser(fromGolangSiteUrl, urlStr) ?? fromGolangDownloadUrl(urlStr);
		}
		/**
		* Parse a crates.io URL — crate page, `/api/v1/.../download`, or a bare
		* `/crates/name/version/download` path.
		*/
		static fromCargoUrl(urlStr) {
			return runUrlParser(fromCargoSiteUrl, urlStr) ?? fromCargoDownloadUrl(urlStr);
		}
		/**
		* Parse an `registry.npmjs.org` metadata / tarball URL.
		*/
		static fromNpmRegistryUrl(urlStr) {
			return runUrlParser(fromNpmRegistryUrl, urlStr);
		}
		/**
		* Parse a `www.npmjs.com` package-page URL.
		*/
		static fromNpmSiteUrl(urlStr) {
			return runUrlParser(fromNpmSiteUrl, urlStr);
		}
		/**
		* Parse a `pypi.org/project/...` page URL.
		*/
		static fromPypiSiteUrl(urlStr) {
			return runUrlParser(fromPypiSiteUrl, urlStr);
		}
		/**
		* Parse a PyPI wheel / sdist distribution filename (URL or bare path).
		*/
		static fromPypiDownloadUrl(urlOrPath) {
			return fromPypiDownloadUrl(urlOrPath);
		}
		/**
		* Parse a `rubygems.org/gems/...` page URL.
		*/
		static fromGemSiteUrl(urlStr) {
			return runUrlParser(fromGemSiteUrl, urlStr);
		}
		/**
		* Parse a RubyGems `.gem` / `.gemspec.rz` distribution filename.
		*/
		static fromGemDownloadUrl(urlOrPath) {
			return fromGemDownloadUrl(urlOrPath);
		}
		/**
		* Parse a `pkg.go.dev` page URL.
		*/
		static fromGolangSiteUrl(urlStr) {
			return runUrlParser(fromGolangSiteUrl, urlStr);
		}
		/**
		* Parse a Go module-proxy download URL or path.
		*/
		static fromGolangDownloadUrl(urlOrPath) {
			return fromGolangDownloadUrl(urlOrPath);
		}
		/**
		* Parse a Maven Central `/maven2/...` URL.
		*/
		static fromMavenSiteUrl(urlStr) {
			return runUrlParser(fromMavenSiteUrl, urlStr);
		}
		/**
		* Parse a NuGet (`www.nuget.org` / `api.nuget.org`) URL.
		*/
		static fromNugetSiteUrl(urlStr) {
			return runUrlParser(fromNugetSiteUrl, urlStr);
		}
		/**
		* Parse a crates.io page / `/api/v1/.../download` URL.
		*/
		static fromCargoSiteUrl(urlStr) {
			return runUrlParser(fromCargoSiteUrl, urlStr);
		}
		/**
		* Parse a bare `/crates/name/version/download` path.
		*/
		static fromCargoDownloadUrl(urlOrPath) {
			return fromCargoDownloadUrl(urlOrPath);
		}
		/**
		* Parse a `github.com/owner/repo[...]` URL.
		*/
		static fromGitHubUrl(urlStr) {
			return runUrlParser(fromGitHubUrl, urlStr);
		}
		/**
		* Parse a `gitlab.com/owner/repo[...]` URL.
		*/
		static fromGitlabUrl(urlStr) {
			return runUrlParser(fromGitlabUrl, urlStr);
		}
		/**
		* Parse a `bitbucket.org/owner/repo[...]` URL.
		*/
		static fromBitbucketUrl(urlStr) {
			return runUrlParser(fromBitbucketUrl, urlStr);
		}
		/**
		* Parse a `packagist.org/packages/...` URL.
		*/
		static fromComposerUrl(urlStr) {
			return runUrlParser(fromComposerUrl, urlStr);
		}
		/**
		* Parse a `hex.pm/packages/...` URL.
		*/
		static fromHexUrl(urlStr) {
			return runUrlParser(fromHexUrl, urlStr);
		}
		/**
		* Parse a `pub.dev/packages/...` URL.
		*/
		static fromPubUrl(urlStr) {
			return runUrlParser(fromPubUrl, urlStr);
		}
		/**
		* Parse a `hub.docker.com/...` URL.
		*/
		static fromDockerUrl(urlStr) {
			return runUrlParser(fromDockerUrl, urlStr);
		}
		/**
		* Parse a `cocoapods.org/pods/...` URL.
		*/
		static fromCocoapodsUrl(urlStr) {
			return runUrlParser(fromCocoapodsUrl, urlStr);
		}
		/**
		* Parse a `hackage.haskell.org/package/...` URL.
		*/
		static fromHackageUrl(urlStr) {
			return runUrlParser(fromHackageUrl, urlStr);
		}
		/**
		* Parse a `cran.r-project.org/web/packages/...` URL.
		*/
		static fromCranUrl(urlStr) {
			return runUrlParser(fromCranUrl, urlStr);
		}
		/**
		* Parse an `anaconda.org/channel/...` URL.
		*/
		static fromCondaUrl(urlStr) {
			return runUrlParser(fromCondaUrl, urlStr);
		}
		/**
		* Parse a `metacpan.org/{pod,dist}/...` URL.
		*/
		static fromCpanUrl(urlStr) {
			return runUrlParser(fromCpanUrl, urlStr);
		}
		/**
		* Parse a `huggingface.co/namespace/name[...]` URL.
		*/
		static fromHuggingfaceUrl(urlStr) {
			return runUrlParser(fromHuggingfaceUrl, urlStr);
		}
		/**
		* Parse a `luarocks.org/modules/...` URL.
		*/
		static fromLuarocksUrl(urlStr) {
			return runUrlParser(fromLuarocksUrl, urlStr);
		}
		/**
		* Parse a `swiftpackageindex.com/owner/repo[/version]` URL.
		*/
		static fromSwiftUrl(urlStr) {
			return runUrlParser(fromSwiftUrl, urlStr);
		}
		/**
		* Parse a `marketplace.visualstudio.com/items?itemName=...` URL.
		*/
		static fromVscodeMarketplaceUrl(urlStr) {
			return runUrlParser(fromVscodeMarketplaceUrl, urlStr);
		}
		/**
		* Parse an `open-vsx.org/extension/...` URL.
		*/
		static fromOpenVsxUrl(urlStr) {
			return runUrlParser(fromOpenVsxUrl, urlStr);
		}
		/**
		* Get all available URLs for a `PackageURL`.
		*
		* This convenience method returns both repository and download URLs in a
		* single call, useful when you need to check all URL options.
		*/
		static getAllUrls(purl) {
			return {
				download: UrlConverter.toDownloadUrl(purl),
				repository: UrlConverter.toRepositoryUrl(purl)
			};
		}
		/**
		* Check if a `PackageURL` type supports download URL conversion.
		*
		* This method checks if the given package type has download URL conversion
		* logic implemented.
		*/
		static supportsDownloadUrl(type) {
			return DOWNLOAD_URL_TYPES.has(type);
		}
		/**
		* Check if a `PackageURL` type supports repository URL conversion.
		*
		* This method checks if the given package type has repository URL conversion
		* logic implemented.
		*/
		static supportsRepositoryUrl(type) {
			return REPOSITORY_URL_TYPES.has(type);
		}
		/**
		* Convert a `PackageURL` to a download URL if possible.
		*
		* This method attempts to generate a download URL where the package's
		* artifact (binary, archive, etc.) can be obtained. Requires a version to be
		* present in the `PackageURL`.
		*/
		static toDownloadUrl(purl) {
			const { name, namespace, type, version } = purl;
			if (!version) return;
			switch (type) {
				case "npm": return {
					type: "tarball",
					url: `https://registry.npmjs.org/${namespace ? `${namespace}/${name}` : name}/-/${name}-${version}.tgz`
				};
				case "pypi": return {
					type: "wheel",
					url: `https://pypi.org/simple/${name}/`
				};
				case "maven":
					if (!namespace) return;
					return {
						type: "jar",
						url: `https://repo1.maven.org/maven2/${(0, import_string.StringPrototypeReplace)(namespace, /\./g, "/")}/${name}/${version}/${name}-${version}.jar`
					};
				case "gem": return {
					type: "gem",
					url: `https://rubygems.org/downloads/${name}-${version}.gem`
				};
				case "cargo": return {
					type: "tarball",
					url: `https://crates.io/api/v1/crates/${name}/${version}/download`
				};
				case "nuget": return {
					type: "zip",
					url: `https://nuget.org/packages/${name}/${version}/download`
				};
				case "composer":
					if (!namespace) return;
					return {
						type: "other",
						url: `https://repo.packagist.org/p2/${namespace}/${name}.json`
					};
				case "hex": return {
					type: "tarball",
					url: `https://repo.hex.pm/tarballs/${name}-${version}.tar`
				};
				case "pub": return {
					type: "tarball",
					url: `https://pub.dev/packages/${name}/versions/${version}.tar.gz`
				};
				case "conda": return {
					type: "tarball",
					url: `https://anaconda.org/${purl["qualifiers"]?.["channel"] ?? "conda-forge"}/${name}/${version}/download`
				};
				case "golang":
					if (!namespace || !name) return;
					return {
						type: "zip",
						url: `https://proxy.golang.org/${encodeGolangProxyPath(namespace)}/${encodeGolangProxyPath(name)}/@v/${encodeGolangProxyPath(version)}.zip`
					};
				default: return;
			}
		}
		/**
		* Convert a `PackageURL` to a repository URL if possible.
		*
		* This method attempts to generate a repository URL where the package's
		* source code can be found. Different package types use different URL
		* patterns and repository hosting services.
		*/
		static toRepositoryUrl(purl) {
			const { name, namespace, type } = purl;
			const { version } = purl;
			switch (type) {
				case "bioconductor": return {
					type: "web",
					url: `https://bioconductor.org/packages/${name}`
				};
				case "bitbucket":
					if (!namespace) return;
					return {
						type: "git",
						url: version ? `https://bitbucket.org/${namespace}/${name}/src/${version}` : `https://bitbucket.org/${namespace}/${name}`
					};
				case "cargo": return {
					type: "web",
					url: `https://crates.io/crates/${name}`
				};
				case "chrome": return {
					type: "web",
					url: `https://chromewebstore.google.com/detail/${name}`
				};
				case "clojars": return {
					type: "web",
					url: `https://clojars.org/${namespace ? `${namespace}/` : ""}${name}`
				};
				case "cocoapods": return {
					type: "web",
					url: `https://cocoapods.org/pods/${name}`
				};
				case "composer": return {
					type: "web",
					url: `https://packagist.org/packages/${namespace ? `${namespace}/` : ""}${name}`
				};
				case "conan": return {
					type: "web",
					url: `https://conan.io/center/recipes/${name}`
				};
				case "conda": return {
					type: "web",
					url: `https://anaconda.org/${purl["qualifiers"]?.["channel"] ?? "conda-forge"}/${name}`
				};
				case "cpan": return {
					type: "web",
					url: namespace && version ? `https://metacpan.org/release/${namespace}/${name}-${version}` : `https://metacpan.org/dist/${name}`
				};
				case "deno": return {
					type: "web",
					url: version ? `https://deno.land/x/${name}@${version}` : `https://deno.land/x/${name}`
				};
				case "docker": {
					const versionSuffix = version ? `?tab=tags&name=${version}` : "";
					if (!namespace || namespace === "library") return {
						type: "web",
						url: `https://hub.docker.com/_/${name}${versionSuffix}`
					};
					return {
						type: "web",
						url: `https://hub.docker.com/r/${namespace}/${name}${versionSuffix}`
					};
				}
				case "elm":
					if (!namespace) return;
					return {
						type: "web",
						url: version ? `https://package.elm-lang.org/packages/${namespace}/${name}/${version}` : `https://package.elm-lang.org/packages/${namespace}/${name}/latest`
					};
				case "gem": return {
					type: "web",
					url: `https://rubygems.org/gems/${name}`
				};
				case "github":
					if (!namespace) return;
					return {
						type: "git",
						url: version ? `https://github.com/${namespace}/${name}/tree/${version}` : `https://github.com/${namespace}/${name}`
					};
				case "gitlab":
					if (!namespace) return;
					return {
						type: "git",
						url: `https://gitlab.com/${namespace}/${name}`
					};
				case "golang":
					if (!namespace) return;
					return {
						type: "web",
						url: version ? `https://pkg.go.dev/${namespace}/${name}@${version}` : `https://pkg.go.dev/${namespace}/${name}`
					};
				case "hackage": return {
					type: "web",
					url: version ? `https://hackage.haskell.org/package/${name}-${version}` : `https://hackage.haskell.org/package/${name}`
				};
				case "hex": return {
					type: "web",
					url: `https://hex.pm/packages/${name}`
				};
				case "homebrew": return {
					type: "web",
					url: `https://formulae.brew.sh/formula/${name}`
				};
				case "huggingface": return {
					type: "web",
					url: `https://huggingface.co/${namespace ? `${namespace}/` : ""}${name}`
				};
				case "luarocks": return {
					type: "web",
					url: `https://luarocks.org/modules/${namespace ? `${namespace}/` : ""}${name}`
				};
				case "maven":
					if (!namespace) return;
					return {
						type: "web",
						url: version ? `https://search.maven.org/artifact/${namespace}/${name}/${version}/jar` : `https://search.maven.org/artifact/${namespace}/${name}`
					};
				case "npm": return {
					type: "web",
					url: version ? `https://www.npmjs.com/package/${namespace ? `${namespace}/` : ""}${name}/v/${version}` : `https://www.npmjs.com/package/${namespace ? `${namespace}/` : ""}${name}`
				};
				case "nuget": return {
					type: "web",
					url: `https://nuget.org/packages/${name}/`
				};
				case "pub": return {
					type: "web",
					url: `https://pub.dev/packages/${name}`
				};
				case "pypi": return {
					type: "web",
					url: `https://pypi.org/project/${name}/`
				};
				case "swift":
					if (!namespace) return;
					return {
						type: "git",
						url: `https://github.com/${namespace}/${name}`
					};
				case "vscode": return {
					type: "web",
					url: `https://marketplace.visualstudio.com/items?itemName=${namespace ? `${namespace}.` : ""}${name}`
				};
				default: return;
			}
		}
	};
	var import_buffer = require_buffer();
	/**
	* @file URL decoding functionality for PURL components. Provides proper error
	*   handling for invalid encoded strings.
	*/
	const decodeComponent = import_globals.decodeURIComponent;
	/**
	* Decode PURL component value from URL encoding.
	*
	* @throws {PurlError} When component cannot be decoded.
	*/
	function decodePurlComponent(comp, encodedComponent) {
		try {
			return decodeComponent(encodedComponent);
		} catch (e) {
			throw new PurlError(`unable to decode "${comp}" component`, { cause: e });
		}
	}
	/*!
	Copyright (c) the purl authors
	
	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:
	
	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.
	
	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
	*/
	/**
	* @file Low-level PURL string parser. Implements `parseString` — the step that
	*   splits a raw purl string into its six components without constructing a
	*   `PackageURL` instance.
	*/
	const OTHER_SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]{0,255}:\/\//;
	const PURL_LIKE_PATTERN = /^[a-zA-Z0-9+.-]{1,256}\//;
	/**
	* Parse a purl string into its components without constructing a `PackageURL`.
	*/
	function parseString(purlStr) {
		if (typeof purlStr !== "string") throw new import_error.ErrorCtor("A purl string argument is required.");
		if (isBlank(purlStr)) return [
			void 0,
			void 0,
			void 0,
			void 0,
			void 0,
			void 0
		];
		const MAX_PURL_LENGTH = 4096;
		if (purlStr.length > MAX_PURL_LENGTH) throw new import_error.ErrorCtor(`Package URL exceeds maximum length of ${MAX_PURL_LENGTH} characters.`);
		if (!(0, import_string.StringPrototypeStartsWith)(purlStr, "pkg:")) {
			const hasOtherScheme = (0, import_regexp.RegExpPrototypeTest)(OTHER_SCHEME_PATTERN, purlStr);
			const looksLikePurl = (0, import_regexp.RegExpPrototypeTest)(PURL_LIKE_PATTERN, purlStr);
			if (!hasOtherScheme && looksLikePurl) return parseString(`pkg:${purlStr}`);
		}
		const colonIndex = (0, import_string.StringPrototypeIndexOf)(purlStr, ":");
		let url;
		let hasAuth = false;
		if (colonIndex !== -1) try {
			const beforeColon = (0, import_string.StringPrototypeSlice)(purlStr, 0, colonIndex);
			const afterColon = (0, import_string.StringPrototypeSlice)(purlStr, colonIndex + 1);
			const trimmedAfterColon = trimLeadingSlashes(afterColon);
			url = new import_url.URLCtor(`${beforeColon}:${trimmedAfterColon}`);
			/* v8 ignore start - V8 coverage sees multiple branch paths that can't all be tested. */
			if (afterColon.length !== trimmedAfterColon.length) {
				const authorityStart = (0, import_string.StringPrototypeIndexOf)(afterColon, "//") + 2;
				const authorityEnd = (0, import_string.StringPrototypeIndexOf)(afterColon, "/", authorityStart);
				hasAuth = (0, import_string.StringPrototypeIncludes)(authorityEnd === -1 ? (0, import_string.StringPrototypeSlice)(afterColon, authorityStart) : (0, import_string.StringPrototypeSlice)(afterColon, authorityStart, authorityEnd), "@");
			}
		} catch (e) {
			throw new PurlError("failed to parse as URL", { cause: e });
		}
		/* v8 ignore next -- Tested: colonIndex === -1 (url undefined) case, but V8 can't see both branches. */ if (url?.protocol !== "pkg:") throw new PurlError("missing required \"pkg\" scheme component");
		if (hasAuth) throw new PurlError("cannot contain a \"user:pass@host:port\"");
		const { pathname } = url;
		const firstSlashIndex = (0, import_string.StringPrototypeIndexOf)(pathname, "/");
		const rawType = decodePurlComponent("type", firstSlashIndex === -1 ? pathname : (0, import_string.StringPrototypeSlice)(pathname, 0, firstSlashIndex));
		if (firstSlashIndex < 1) return [
			rawType,
			void 0,
			void 0,
			void 0,
			void 0,
			void 0
		];
		let rawVersion;
		/* v8 ignore start -- npm vs non-npm path logic both tested but V8 sees extra branches. */
		let atSignIndex = rawType === "npm" ? (0, import_string.StringPrototypeIndexOf)(pathname, "@", firstSlashIndex + 2) : (0, import_string.StringPrototypeLastIndexOf)(pathname, "@");
		/* v8 ignore stop */
		if (atSignIndex !== -1 && atSignIndex < (0, import_string.StringPrototypeLastIndexOf)(pathname, "/")) atSignIndex = -1;
		const beforeVersion = (0, import_string.StringPrototypeSlice)(pathname, rawType.length + 1, atSignIndex === -1 ? pathname.length : atSignIndex);
		if (atSignIndex !== -1) rawVersion = decodePurlComponent("version", (0, import_string.StringPrototypeSlice)(pathname, atSignIndex + 1));
		let rawNamespace;
		let rawName;
		const lastSlashIndex = (0, import_string.StringPrototypeLastIndexOf)(beforeVersion, "/");
		if (lastSlashIndex === -1) rawName = decodePurlComponent("name", beforeVersion);
		else {
			rawName = decodePurlComponent("name", (0, import_string.StringPrototypeSlice)(beforeVersion, lastSlashIndex + 1));
			rawNamespace = decodePurlComponent("namespace", (0, import_string.StringPrototypeSlice)(beforeVersion, 0, lastSlashIndex));
		}
		let rawQualifiers;
		if (url.searchParams.size !== 0) {
			const search = (0, import_string.StringPrototypeSlice)(url.search, 1);
			const searchParams = new import_url.URLSearchParamsCtor();
			const entries = (0, import_string.StringPrototypeSplit)(search, "&");
			for (let i = 0, { length } = entries; i < length; i += 1) {
				const entry = entries[i];
				const eqIndex = (0, import_string.StringPrototypeIndexOf)(entry, "=");
				const key = eqIndex === -1 ? entry : (0, import_string.StringPrototypeSlice)(entry, 0, eqIndex);
				if (key.length === 0) throw new PurlError("qualifier key must not be empty");
				const value = decodePurlComponent("qualifiers", eqIndex === -1 ? "" : (0, import_string.StringPrototypeSlice)(entry, eqIndex + 1));
				/* v8 ignore next -- URLSearchParams.append has internal V8 branches we can't control. */ searchParams.append(key, value);
			}
			rawQualifiers = searchParams;
		}
		let rawSubpath;
		const { hash } = url;
		if (hash.length !== 0) rawSubpath = decodePurlComponent("subpath", (0, import_string.StringPrototypeSlice)(hash, 1));
		return [
			rawType,
			rawNamespace,
			rawName,
			rawVersion,
			rawQualifiers,
			rawSubpath
		];
	}
	/*!
	Copyright (c) the purl authors
	
	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:
	
	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.
	
	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
	*/
	/**
	* @file Standalone implementations of `PackageURL` static factory/utility
	*   methods. Extracted to keep `package-url.mts` under the 500-line soft cap.
	*   Methods that construct a `PackageURL` instance receive the class via a
	*   lazy registration call (`registerPackageURLStatics`) to avoid circular
	*   imports.
	*/
	var import_json = require_json();
	let cachedPackageURL;
	const FLYWEIGHT_CACHE_MAX = 1024;
	const flyweightCache = new import_map_set.MapCtor();
	/**
	* Freeze a freshly parsed `PackageURL` before it is shared out of the flyweight
	* cache. A `PackageURL`'s object graph is exactly two levels — the instance,
	* plus a flat string-valued qualifiers bag — so two `ObjectFreeze` calls cover
	* it without the queue, `WeakSet`, and `ReflectOwnKeys` walk that the general
	* `recursiveFreeze` needs for arbitrary graphs.
	*/
	function freezeParsedPurl(purl) {
		const { qualifiers } = purl;
		if (qualifiers !== void 0) (0, import_object.ObjectFreeze)(qualifiers);
		(0, import_object.ObjectFreeze)(purl);
	}
	/**
	* Create `PackageURL` from JSON string.
	*/
	function fromJSON(json) {
		if (typeof json !== "string") throw new import_error.ErrorCtor("JSON string argument is required.");
		const MAX_JSON_SIZE = 1024 * 1024;
		if ((0, import_buffer.BufferByteLength)(json, "utf8") > MAX_JSON_SIZE) throw new import_error.ErrorCtor(`JSON string exceeds maximum size limit of ${MAX_JSON_SIZE} bytes`);
		let parsed;
		try {
			parsed = (0, import_json.JSONParse)(json);
		} catch (e) {
			throw new import_error.SyntaxErrorCtor("Failed to parse PackageURL from JSON", { cause: e });
		}
		if (!parsed || typeof parsed !== "object" || (0, import_array.ArrayIsArray)(parsed)) throw new import_error.ErrorCtor("JSON must parse to an object.");
		const parsedRecord = parsed;
		return fromObject({
			__proto__: null,
			type: parsedRecord["type"],
			namespace: parsedRecord["namespace"],
			name: parsedRecord["name"],
			version: parsedRecord["version"],
			qualifiers: parsedRecord["qualifiers"],
			subpath: parsedRecord["subpath"]
		});
	}
	function fromNpm(specifier) {
		const PackageURL = cachedPackageURL;
		const { name, namespace, version } = parseNpmSpecifier(specifier);
		return new PackageURL("npm", namespace, name, version, void 0, void 0);
	}
	function fromObject(obj) {
		const PackageURL = cachedPackageURL;
		if (!isObject(obj)) throw new import_error.ErrorCtor("Object argument is required.");
		const typedObj = obj;
		return new PackageURL(typedObj["type"], typedObj["namespace"], typedObj["name"], typedObj["version"], typedObj["qualifiers"], typedObj["subpath"]);
	}
	function fromSpec(type, specifier) {
		const PackageURL = cachedPackageURL;
		switch (type) {
			case "npm": {
				const { name, namespace, version } = parseNpmSpecifier(specifier);
				return new PackageURL("npm", namespace, name, version, void 0, void 0);
			}
			default: throw new import_error.ErrorCtor(`Unsupported package type: ${type}. Currently supported: npm`);
		}
	}
	function fromString(purlStr) {
		const PackageURL = cachedPackageURL;
		if (typeof purlStr === "string") {
			const cached = flyweightCache.get(purlStr);
			if (cached !== void 0) {
				flyweightCache.delete(purlStr);
				flyweightCache.set(purlStr, cached);
				return cached;
			}
		}
		const purl = new PackageURL(...parseString(purlStr));
		freezeParsedPurl(purl);
		if (typeof purlStr === "string") {
			if (flyweightCache.size >= FLYWEIGHT_CACHE_MAX) flyweightCache.delete(flyweightCache.keys().next().value);
			flyweightCache.set(purlStr, purl);
		}
		return purl;
	}
	function fromUrl(urlStr) {
		return UrlConverter.fromUrl(urlStr);
	}
	function isValid(purlStr) {
		return tryFromString(purlStr).isOk();
	}
	function registerPackageURLStatics(ctor) {
		cachedPackageURL = ctor;
	}
	function tryFromJSON(json) {
		return ResultUtils.from(() => fromJSON(json));
	}
	function tryFromObject(obj) {
		return ResultUtils.from(() => fromObject(obj));
	}
	function tryFromString(purlStr) {
		return ResultUtils.from(() => fromString(purlStr));
	}
	function tryParseString(purlStr) {
		return ResultUtils.from(() => parseString(purlStr));
	}
	/*!
	Copyright (c) the purl authors
	
	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:
	
	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.
	
	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
	*/
	/**
	* @file Package URL parsing and construction utilities. Note on `instanceof`
	*   checks: When this module is compiled to CommonJS and imported from ESM
	*   contexts, `instanceof` checks may fail due to module system
	*   interoperability issues. See `package-url-builder.ts` for detailed
	*   explanation and workarounds.
	*/
	const THROWS_OPTIONS = (0, import_object.ObjectFreeze)({
		__proto__: null,
		throws: true
	});
	/**
	* Package URL parser and constructor implementing the PURL specification.
	* Provides methods to parse, construct, and manipulate Package URLs with
	* validation and normalization.
	*/
	var PackageURL = class PackageURL {
		static Component = recursiveFreeze(PurlComponent);
		static KnownQualifierNames = recursiveFreeze(PurlQualifierNames);
		static Type = recursiveFreeze(PurlType);
		/**
		* Memoized canonical string. A private field rather than a property so
		* `toString()` can fill it lazily even after `fromString` freezes the
		* instance — `Object.freeze` seals properties, not private fields.
		*/
		#cachedString;
		name;
		namespace;
		qualifiers;
		subpath;
		type;
		version;
		constructor(rawType, rawNamespace, rawName, rawVersion, rawQualifiers, rawSubpath) {
			const type = isNonEmptyString(rawType) ? normalizeType(rawType) : rawType;
			validateType(type, THROWS_OPTIONS);
			const namespace = isNonEmptyString(rawNamespace) ? normalizeNamespace(rawNamespace) : rawNamespace;
			validateNamespace(namespace, THROWS_OPTIONS);
			const name = isNonEmptyString(rawName) ? normalizeName(rawName) : rawName;
			validateName(name, THROWS_OPTIONS);
			const version = isNonEmptyString(rawVersion) ? normalizeVersion(rawVersion) : rawVersion;
			validateVersion(version, THROWS_OPTIONS);
			const qualifiers = typeof rawQualifiers === "string" || isObject(rawQualifiers) ? normalizeQualifiers(rawQualifiers) : rawQualifiers;
			validateQualifiers(qualifiers, THROWS_OPTIONS);
			const subpath = isNonEmptyString(rawSubpath) ? normalizeSubpath(rawSubpath) : rawSubpath;
			validateSubpath(subpath, THROWS_OPTIONS);
			this.type = type;
			this.name = name;
			if (namespace !== void 0) this.namespace = namespace;
			if (version !== void 0) this.version = version;
			this.qualifiers = qualifiers ?? void 0;
			if (subpath !== void 0) this.subpath = subpath;
			const typeHelpers = PurlType[type];
			const normalize = typeHelpers?.["normalize"] ?? PurlTypNormalizer;
			const validate = typeHelpers?.["validate"] ?? PurlTypeValidator;
			normalize(this);
			validate(this, THROWS_OPTIONS);
		}
		/**
		* Convert `PackageURL` to object for `JSON.stringify` compatibility.
		*/
		toJSON() {
			return this.toObject();
		}
		/**
		* Convert `PackageURL` to JSON string representation.
		*/
		toJSONString() {
			return (0, import_json.JSONStringify)(this.toObject());
		}
		/**
		* Convert `PackageURL` to a plain object representation.
		*/
		toObject() {
			const { qualifiers } = this;
			let qualifiersCopy;
			if (qualifiers !== void 0) {
				qualifiersCopy = (0, import_object.ObjectCreate)(null);
				const keys = (0, import_object.ObjectKeys)(qualifiers);
				for (let i = 0, { length } = keys; i < length; i += 1) {
					const key = keys[i];
					qualifiersCopy[key] = qualifiers[key];
				}
			}
			return {
				__proto__: null,
				type: this.type,
				namespace: this.namespace,
				name: this.name,
				version: this.version,
				qualifiers: qualifiersCopy,
				subpath: this.subpath
			};
		}
		/**
		* Get the package specifier string without the scheme and type prefix.
		*
		* Returns `namespace/name@version?qualifiers#subpath` — the package identity
		* without the `pkg:type/` prefix.
		*
		* @returns Spec string (e.g., `'@babel/core@7.0.0'` for
		*   `pkg:npm/%40babel/core@7.0.0`)
		*/
		toSpec() {
			return stringifySpec(this);
		}
		toString() {
			let cached = this.#cachedString;
			if (cached === void 0) {
				cached = stringify(this);
				this.#cachedString = cached;
			}
			return cached;
		}
		/**
		* Create a new `PackageURL` with a different version. Returns a new instance
		* — the original is unchanged.
		*
		* @param version - New version string.
		*
		* @returns New `PackageURL` with the updated version
		*/
		withVersion(version) {
			return new PackageURL(this.type, this.namespace, this.name, version, this.qualifiers, this.subpath);
		}
		/**
		* Create a new `PackageURL` with a different namespace. Returns a new
		* instance — the original is unchanged.
		*
		* @param namespace - New namespace string.
		*
		* @returns New `PackageURL` with the updated namespace
		*/
		withNamespace(namespace) {
			return new PackageURL(this.type, namespace, this.name, this.version, this.qualifiers, this.subpath);
		}
		/**
		* Create a new `PackageURL` with a single qualifier added or updated. Returns
		* a new instance — the original is unchanged.
		*
		* Keys are lowercased per the PURL spec. Values are trimmed, and a value that
		* is empty after trimming drops the qualifier entirely.
		*
		* @param key - Qualifier key (will be lowercased)
		* @param value - Qualifier value (trimmed; empty-after-trim drops the key)
		*
		* @returns New `PackageURL` with the qualifier set
		*/
		withQualifier(key, value) {
			return new PackageURL(this.type, this.namespace, this.name, this.version, {
				__proto__: null,
				...this.qualifiers,
				[key]: value
			}, this.subpath);
		}
		/**
		* Create a new `PackageURL` with all qualifiers replaced. Returns a new
		* instance — the original is unchanged.
		*
		* @param qualifiers - New qualifiers object (or `undefined` to remove all)
		*
		* @returns New `PackageURL` with the updated qualifiers
		*/
		withQualifiers(qualifiers) {
			return new PackageURL(this.type, this.namespace, this.name, this.version, qualifiers, this.subpath);
		}
		/**
		* Create a new `PackageURL` with a different subpath. Returns a new instance
		* — the original is unchanged.
		*
		* @param subpath - New subpath string.
		*
		* @returns New `PackageURL` with the updated subpath
		*/
		withSubpath(subpath) {
			return new PackageURL(this.type, this.namespace, this.name, this.version, this.qualifiers, subpath);
		}
		/**
		* Compare this `PackageURL` with another for equality.
		*
		* Two `purl`s are considered equal if their canonical string representations
		* match. This comparison is case-sensitive after normalization.
		*
		* @param other - The `PackageURL` to compare with.
		*
		* @returns `true` if the `purl`s are equal, `false` otherwise
		*/
		equals(other) {
			return equalsPurls(this, other);
		}
		static equals(a, b) {
			return equalsPurls(a, b);
		}
		compare(other) {
			return comparePurls(this, other);
		}
		static compare(a, b) {
			return comparePurls(a, b);
		}
		static fromJSON(json) {
			return fromJSON(json);
		}
		static fromObject(obj) {
			return fromObject(obj);
		}
		static fromString(purlStr) {
			return fromString(purlStr);
		}
		static fromNpm(specifier) {
			return fromNpm(specifier);
		}
		static fromSpec(type, specifier) {
			return fromSpec(type, specifier);
		}
		static parseString(purlStr) {
			return parseString(purlStr);
		}
		static isValid(purlStr) {
			return isValid(purlStr);
		}
		static fromUrl(urlStr) {
			return fromUrl(urlStr);
		}
		static tryFromJSON(json) {
			return tryFromJSON(json);
		}
		static tryFromObject(obj) {
			return tryFromObject(obj);
		}
		static tryFromString(purlStr) {
			return tryFromString(purlStr);
		}
		static tryParseString(purlStr) {
			return tryParseString(purlStr);
		}
	};
	const staticProps = [
		"Component",
		"KnownQualifierNames",
		"Type"
	];
	for (let i = 0, { length } = staticProps; i < length; i += 1) {
		const staticProp = staticProps[i];
		(0, import_reflect.ReflectDefineProperty)(PackageURL, staticProp, {
			...(0, import_reflect.ReflectGetOwnPropertyDescriptor)(PackageURL, staticProp),
			writable: false
		});
	}
	(0, import_reflect.ReflectSetPrototypeOf)(PackageURL.prototype, null);
	registerPackageURL(PackageURL);
	registerPackageURLForUrlConverter(PackageURL);
	registerPackageURLStatics(PackageURL);
	/**
	* @file Static factory methods for `PurlBuilder` — one method per known
	*   package type. Kept separate from the instance API to stay under the
	*   per-file line cap.
	*/
	/**
	* Create a builder with the `bitbucket` package type preset.
	*
	* @example
	*   ;`PurlBuilder.bitbucket().namespace('owner').name('repo').build()`
	*/
	function bitbucket() {
		return new PurlBuilder().type("bitbucket");
	}
	/**
	* Create a builder with the `cargo` package type preset.
	*
	* @example
	*   ;`PurlBuilder.cargo().name('serde').version('1.0.0').build()`
	*/
	function cargo() {
		return new PurlBuilder().type("cargo");
	}
	/**
	* Create a builder with the `cocoapods` package type preset.
	*
	* @example
	*   ;`PurlBuilder.cocoapods().name('Alamofire').version('5.9.1').build()`
	*/
	function cocoapods() {
		return new PurlBuilder().type("cocoapods");
	}
	/**
	* Create a builder with the `composer` package type preset.
	*
	* @example
	*   ;`PurlBuilder.composer().namespace('laravel').name('framework').build()`
	*/
	function composer() {
		return new PurlBuilder().type("composer");
	}
	/**
	* Create a builder with the `conan` package type preset.
	*
	* @example
	*   ;`PurlBuilder.conan().name('zlib').version('1.3.1').build()`
	*/
	function conan() {
		return new PurlBuilder().type("conan");
	}
	/**
	* Create a builder with the `conda` package type preset.
	*
	* @example
	*   ;`PurlBuilder.conda().name('numpy').version('1.26.4').build()`
	*/
	function conda() {
		return new PurlBuilder().type("conda");
	}
	/**
	* Create a builder with the `cran` package type preset.
	*
	* @example
	*   ;`PurlBuilder.cran().name('ggplot2').version('3.5.0').build()`
	*/
	function cran() {
		return new PurlBuilder().type("cran");
	}
	/**
	* Create a new empty builder instance.
	*
	* This is a convenience factory method that returns a new `PurlBuilder`
	* instance ready for configuration.
	*/
	function createPurlBuilder() {
		return new PurlBuilder();
	}
	/**
	* Create a builder with the `deb` package type preset.
	*
	* @example
	*   ;`PurlBuilder.deb().namespace('debian').name('curl').version('8.5.0').build()`
	*/
	function deb() {
		return new PurlBuilder().type("deb");
	}
	/**
	* Create a builder with the `docker` package type preset.
	*
	* @example
	*   ;`PurlBuilder.docker().namespace('library').name('nginx').version('latest').build()`
	*/
	function docker() {
		return new PurlBuilder().type("docker");
	}
	/**
	* Create a builder with the `gem` package type preset.
	*
	* @example
	*   ;`PurlBuilder.gem().name('rails').version('7.0.0').build()`
	*/
	function gem() {
		return new PurlBuilder().type("gem");
	}
	/**
	* Create a builder with the `github` package type preset.
	*
	* @example
	*   ;`PurlBuilder.github().namespace('socketdev').name('socket-cli').build()`
	*/
	function github() {
		return new PurlBuilder().type("github");
	}
	/**
	* Create a builder with the `gitlab` package type preset.
	*
	* @example
	*   ;`PurlBuilder.gitlab().namespace('owner').name('project').build()`
	*/
	function gitlab() {
		return new PurlBuilder().type("gitlab");
	}
	/**
	* Create a builder with the `golang` package type preset.
	*
	* @example
	*   ;`PurlBuilder.golang().namespace('github.com/go').name('text').build()`
	*/
	function golang() {
		return new PurlBuilder().type("golang");
	}
	/**
	* Create a builder with the `hackage` package type preset.
	*
	* @example
	*   ;`PurlBuilder.hackage().name('aeson').version('2.2.1.0').build()`
	*/
	function hackage() {
		return new PurlBuilder().type("hackage");
	}
	/**
	* Create a builder with the `hex` package type preset.
	*
	* @example
	*   ;`PurlBuilder.hex().name('phoenix').version('1.7.12').build()`
	*/
	function hex() {
		return new PurlBuilder().type("hex");
	}
	/**
	* Create a builder with the `huggingface` package type preset.
	*
	* @example
	*   ;`PurlBuilder.huggingface().name('bert-base-uncased').build()`
	*/
	function huggingface() {
		return new PurlBuilder().type("huggingface");
	}
	/**
	* Create a builder with the `luarocks` package type preset.
	*
	* @example
	*   ;`PurlBuilder.luarocks().name('luasocket').version('3.1.0').build()`
	*/
	function luarocks() {
		return new PurlBuilder().type("luarocks");
	}
	/**
	* Create a builder with the `maven` package type preset.
	*
	* @example
	*   ;`PurlBuilder.maven().namespace('org.apache').name('commons-lang3').build()`
	*/
	function maven() {
		return new PurlBuilder().type("maven");
	}
	/**
	* Create a builder with the `npm` package type preset.
	*
	* @example
	*   ;`PurlBuilder.npm().name('lodash').version('4.17.21').build()`
	*/
	function npm() {
		return new PurlBuilder().type("npm");
	}
	/**
	* Create a builder with the `nuget` package type preset.
	*
	* @example
	*   ;`PurlBuilder.nuget().name('Newtonsoft.Json').version('13.0.3').build()`
	*/
	function nuget() {
		return new PurlBuilder().type("nuget");
	}
	/**
	* Create a builder with the `oci` package type preset.
	*
	* @example
	*   ;`PurlBuilder.oci().name('nginx').version('sha256:abc123').build()`
	*/
	function oci() {
		return new PurlBuilder().type("oci");
	}
	/**
	* Create a builder with the `pub` package type preset.
	*
	* @example
	*   ;`PurlBuilder.pub().name('flutter').version('3.19.0').build()`
	*/
	function pub() {
		return new PurlBuilder().type("pub");
	}
	/**
	* Create a builder with the `pypi` package type preset.
	*
	* @example
	*   ;`PurlBuilder.pypi().name('requests').version('2.31.0').build()`
	*/
	function pypi() {
		return new PurlBuilder().type("pypi");
	}
	/**
	* Create a builder with the `rpm` package type preset.
	*
	* @example
	*   ;`PurlBuilder.rpm().namespace('fedora').name('curl').version('8.5.0').build()`
	*/
	function rpm() {
		return new PurlBuilder().type("rpm");
	}
	/**
	* Create a builder with the `swift` package type preset.
	*
	* @example
	*   ;`PurlBuilder.swift().namespace('apple').name('swift-nio').version('2.64.0').build()`
	*/
	function swift() {
		return new PurlBuilder().type("swift");
	}
	/*!
	Copyright (c) the purl authors
	
	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:
	
	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.
	
	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
	*/
	/**
	* @file Builder pattern implementation for `PackageURL` construction with
	*   fluent API.
	*/
	/**
	* Known Limitation: `instanceof` checks with ESM/CommonJS interop
	* ==============================================================
	*
	* When using `PurlBuilder` in environments that mix ESM and CommonJS modules
	* (such as Vitest tests importing CommonJS-compiled code as ESM), the
	* `instanceof` operator may not work reliably for checking if the built objects
	* are instances of `PackageURL`.
	*
	* This occurs because: - `PurlBuilder` internally imports `PackageURL` using
	* CommonJS `require()` - External code may import `PackageURL` using ESM
	* `import` - Node.js creates different wrapper objects for the same class - The
	* `instanceof` check fails due to different object identities.
	*
	* Workaround: Instead of: `purl instanceof PackageURL` Use:
	* `purl.constructor.name === 'PackageURL'` or check for expected
	* properties/methods.
	*
	* This limitation only affects `instanceof` checks, not the actual
	* functionality of the created `PackageURL` objects.
	*/
	/**
	* Builder class for constructing `PackageURL` instances using a fluent API.
	*
	* This class provides a convenient way to build `PackageURL` objects step by
	* step with method chaining. Each method returns the builder instance, allowing
	* for fluent construction patterns.
	*
	* @example
	*   ;```typescript
	*   const purl = PurlBuilder.npm().name('lodash').version('4.17.21').build()
	*   ```
	*/
	var PurlBuilder = class PurlBuilder {
		/**
		* The package type (e.g., `'npm'`, `'pypi'`, `'maven'`).
		*/
		_type;
		/**
		* The package namespace (organization, group, or scope).
		*/
		_namespace;
		/**
		* The package name (required for valid `PackageURL`s).
		*/
		_name;
		/**
		* The package version string.
		*/
		_version;
		/**
		* Key-value pairs of additional package qualifiers.
		*/
		_qualifiers;
		/**
		* Optional subpath within the package.
		*/
		_subpath;
		/**
		* Build and return the final `PackageURL` instance.
		*
		* This method creates a new `PackageURL` instance using all the properties
		* set on this builder. The `PackageURL` constructor will handle validation
		* and normalization of the provided values.
		*
		* @throws {Error} If the configuration results in an invalid `PackageURL`
		*/
		build() {
			return new PackageURL(this._type, this._namespace, this._name, this._version, this._qualifiers, this._subpath);
		}
		/**
		* Set the package name for the `PackageURL`.
		*
		* This is the core identifier for the package and is required for all valid
		* `PackageURL`s. The name should be the canonical package name as it appears
		* in the package repository.
		*/
		name(name) {
			this._name = name;
			return this;
		}
		/**
		* Set the package namespace for the `PackageURL`.
		*
		* The namespace represents different concepts depending on the package type:
		* - `npm`: organization or scope (e.g., `'@angular'` for `'@angular/core'`) -
		* `maven`: `groupId` (e.g., `'org.apache.commons'`) - `pypi`: typically
		* unused.
		*/
		namespace(namespace) {
			this._namespace = namespace;
			return this;
		}
		/**
		* Add a single qualifier key-value pair.
		*
		* This method allows adding qualifiers incrementally. If the qualifier key
		* already exists, its value will be overwritten.
		*/
		qualifier(key, value) {
			if (!this._qualifiers) this._qualifiers = { __proto__: null };
			this._qualifiers[key] = value;
			return this;
		}
		/**
		* Set all qualifiers at once, replacing any existing qualifiers.
		*
		* Qualifiers provide additional metadata about the package such as: - `arch`:
		* target architecture - `os`: target operating system - `classifier`:
		* additional classifier for the package.
		*/
		qualifiers(qualifiers) {
			this._qualifiers = {
				__proto__: null,
				...qualifiers
			};
			return this;
		}
		/**
		* Set the subpath for the `PackageURL`.
		*
		* The subpath represents a path within the package, useful for referencing
		* specific files or directories within a package. It should not start with a
		* forward slash.
		*/
		subpath(subpath) {
			this._subpath = subpath;
			return this;
		}
		/**
		* Set the package type for the `PackageURL`.
		*/
		type(type) {
			this._type = type;
			return this;
		}
		/**
		* Set the package version for the `PackageURL`.
		*
		* The version string should match the format used by the package repository.
		* Some package types may normalize version formats (e.g., removing leading
		* `'v'`).
		*/
		version(version) {
			this._version = version;
			return this;
		}
		/**
		* Create a builder from an existing `PackageURL` instance.
		*
		* This factory method copies all properties from an existing `PackageURL`
		* into a new builder, allowing for modification of existing URLs.
		*/
		static from(purl) {
			const builder = new PurlBuilder();
			if (purl.type !== void 0) builder._type = purl.type;
			if (purl.namespace !== void 0) builder._namespace = purl.namespace;
			if (purl.name !== void 0) builder._name = purl.name;
			if (purl.version !== void 0) builder._version = purl.version;
			if (purl.qualifiers !== void 0) {
				const qualifiersObj = purl.qualifiers;
				builder._qualifiers = (0, import_object.ObjectFromEntries)((0, import_array.ArrayPrototypeMap)((0, import_object.ObjectEntries)(qualifiersObj), ([key, value]) => [key, String(value)]));
			}
			if (purl.subpath !== void 0) builder._subpath = purl.subpath;
			return builder;
		}
		static bitbucket = bitbucket;
		static cargo = cargo;
		static cocoapods = cocoapods;
		static composer = composer;
		static conan = conan;
		static conda = conda;
		static cran = cran;
		static create = createPurlBuilder;
		static deb = deb;
		static docker = docker;
		static gem = gem;
		static github = github;
		static gitlab = gitlab;
		static golang = golang;
		static hackage = hackage;
		static hex = hex;
		static huggingface = huggingface;
		static luarocks = luarocks;
		static maven = maven;
		static npm = npm;
		static nuget = nuget;
		static oci = oci;
		static pub = pub;
		static pypi = pypi;
		static rpm = rpm;
		static swift = swift;
	};
	/**
	* @file Split a raw ecosystem package name into its PURL `namespace` and `name`
	*   components per the package-url type rules
	*   (https://github.com/package-url/purl-spec/blob/main/PURL-TYPES.rst). A
	*   PURL's `namespace` means different things per type — an npm scope, a maven
	*   groupId, a composer vendor, an openvsx publisher — and the split point
	*   differs (first slash, last slash, colon-or-slash, scoped-only). Consumers
	*   that hand-roll this per-type table tend to forget a type (composer was a
	*   real instance), folding the namespace into the name and breaking lookups.
	*   This is the single spec-aware table they can call instead.
	*/
	const FIRST_SLASH_TYPES = /* @__PURE__ */ new Set([
		"composer",
		"openvsx",
		"vscode",
		"vscode-extension"
	]);
	const LAST_SLASH_TYPES = /* @__PURE__ */ new Set(["golang"]);
	function splitOnFirstSlash(packageName) {
		const slash = (0, import_string.StringPrototypeIndexOf)(packageName, "/");
		if (slash === -1) return {
			name: packageName,
			namespace: void 0
		};
		return {
			name: (0, import_string.StringPrototypeSlice)(packageName, slash + 1),
			namespace: (0, import_string.StringPrototypeSlice)(packageName, 0, slash)
		};
	}
	/**
	* Split `packageName` into `{ namespace, name }` per the PURL rules for `type`.
	*
	* - `composer`, `openvsx`, `vscode`(-extension): vendor/publisher before the
	*   first slash (`laravel/framework` → `laravel` + `framework`).
	* - `golang`: module path before the last slash (`github.com/user/repo` →
	*   `github.com/user` + `repo`).
	* - `maven`: groupId before a `:` or, failing that, the first `/`
	*   (`org.apache.commons:commons-lang3`).
	* - `npm`: only scoped names split (`@scope/name`); a bare name has no namespace.
	* - Any other type: the whole string is the `name`, no namespace.
	*
	* @param type - PURL type / ecosystem (case-insensitive, e.g. `'composer'`).
	* @param packageName - Raw package name (no version), e.g.
	*   `'laravel/framework'`.
	*
	* @returns The `{ namespace, name }` split.
	*
	* @throws {Error} If `type` or `packageName` is not a non-empty string.
	*/
	function splitPurlPackageName(type, packageName) {
		const normalizedType = normalizeType(type);
		if (!normalizedType) throw new import_error.ErrorCtor("PURL type string is required.");
		if (typeof packageName !== "string" || packageName.length === 0) throw new import_error.ErrorCtor("package name string is required.");
		if (FIRST_SLASH_TYPES.has(normalizedType)) return splitOnFirstSlash(packageName);
		if (LAST_SLASH_TYPES.has(normalizedType)) {
			const slash = (0, import_string.StringPrototypeLastIndexOf)(packageName, "/");
			if (slash === -1) return {
				name: packageName,
				namespace: void 0
			};
			return {
				name: (0, import_string.StringPrototypeSlice)(packageName, slash + 1),
				namespace: (0, import_string.StringPrototypeSlice)(packageName, 0, slash)
			};
		}
		if (normalizedType === "maven") {
			if ((0, import_string.StringPrototypeIncludes)(packageName, ":")) {
				const colon = (0, import_string.StringPrototypeIndexOf)(packageName, ":");
				return {
					name: (0, import_string.StringPrototypeSlice)(packageName, colon + 1),
					namespace: (0, import_string.StringPrototypeSlice)(packageName, 0, colon)
				};
			}
			return splitOnFirstSlash(packageName);
		}
		if (normalizedType === "npm") {
			if ((0, import_string.StringPrototypeStartsWith)(packageName, "@") && (0, import_string.StringPrototypeIncludes)(packageName, "/")) return splitOnFirstSlash(packageName);
			return {
				name: packageName,
				namespace: void 0
			};
		}
		return {
			name: packageName,
			namespace: void 0
		};
	}
	/**
	* @file Semver types and utilities used by the VERS range implementation.
	*   Provides parsing, comparison, and constraint parsing for semver-based
	*   VERS schemes.
	*/
	var import_math = require_math();
	const COMPARATORS = (0, import_object.ObjectFreeze)([
		"!=",
		"<=",
		">=",
		"<",
		">",
		"="
	]);
	const DIGITS_ONLY = /^\d+$/;
	const regexSemverNumberedGroups = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
	/**
	* Compare two prerelease identifier arrays per semver spec. Returns `-1`, `0`,
	* or `1`.
	*/
	function comparePrereleases(a, b) {
		if (a.length === 0 && b.length === 0) return 0;
		if (a.length === 0) return 1;
		if (b.length === 0) return -1;
		const len = (0, import_math.MathMin)(a.length, b.length);
		for (let i = 0; i < len; i += 1) {
			const ai = a[i];
			const bi = b[i];
			if (ai === bi) continue;
			const aNum = (0, import_regexp.RegExpPrototypeTest)(DIGITS_ONLY, ai);
			const bNum = (0, import_regexp.RegExpPrototypeTest)(DIGITS_ONLY, bi);
			if (aNum && bNum) {
				const diff = Number(ai) - Number(bi);
				if (diff !== 0) return diff < 0 ? -1 : 1;
			} else if (aNum) return -1;
			else if (bNum) return 1;
			else {
				if (ai < bi) return -1;
				if (ai > bi) return 1;
			}
		}
		if (a.length !== b.length) return a.length < b.length ? -1 : 1;
		return 0;
	}
	/**
	* Compare two semver version strings. Returns `-1` if `a < b`, `0` if `a ===
	* b`, `1` if `a > b`. Build metadata is ignored per semver spec.
	*/
	function compareSemver(a, b) {
		const pa = parseSemver(a);
		const pb = parseSemver(b);
		if (pa.major !== pb.major) return pa.major < pb.major ? -1 : 1;
		if (pa.minor !== pb.minor) return pa.minor < pb.minor ? -1 : 1;
		if (pa.patch !== pb.patch) return pa.patch < pb.patch ? -1 : 1;
		const pre = comparePrereleases(pa.prerelease, pb.prerelease);
		if (pre !== 0) return pre < 0 ? -1 : 1;
		return 0;
	}
	/**
	* Parse a single constraint string into comparator and version.
	*/
	function parseConstraint(raw) {
		const trimmed = (0, import_string.StringPrototypeTrim)(raw);
		if (trimmed === "*") return (0, import_object.ObjectFreeze)({
			__proto__: null,
			comparator: "*",
			version: "*"
		});
		for (let i = 0, { length } = COMPARATORS; i < length; i += 1) {
			const op = COMPARATORS[i];
			if ((0, import_string.StringPrototypeStartsWith)(trimmed, op)) {
				const version = (0, import_string.StringPrototypeTrim)((0, import_string.StringPrototypeSlice)(trimmed, op.length));
				if (version.length === 0) throw new PurlError(`empty version after comparator "${op}"`);
				return (0, import_object.ObjectFreeze)({
					__proto__: null,
					comparator: op,
					version
				});
			}
		}
		if (trimmed.length === 0) throw new PurlError("vers constraint must not be empty (use \"*\" for the wildcard)");
		return (0, import_object.ObjectFreeze)({
			__proto__: null,
			comparator: "=",
			version: trimmed
		});
	}
	/**
	* Parse a semver string into comparable components.
	*/
	function parseSemver(version) {
		const match = (0, import_regexp.RegExpPrototypeExec)(regexSemverNumberedGroups, version);
		if (!match) throw new PurlError(`semver version "${version}" must match MAJOR.MINOR.PATCH (e.g. "1.2.3")`);
		const major = Number(match[1]);
		const minor = Number(match[2]);
		const patch = Number(match[3]);
		if (major > Number.MAX_SAFE_INTEGER || minor > Number.MAX_SAFE_INTEGER || patch > Number.MAX_SAFE_INTEGER) throw new PurlError(`version component exceeds maximum safe integer in "${version}"`);
		return {
			major,
			minor,
			patch,
			prerelease: match[4] ? (0, import_string.StringPrototypeSplit)(match[4], ".") : []
		};
	}
	/**
	* @file VERS (VErsion Range Specifier) implementation. Implements the VERS
	*   specification for version range matching. VERS is a companion standard to
	*   PURL, currently in pre-standard draft with Ecma submission planned for late
	*   2026. **Early adoption warning:** The VERS spec is not yet finalized. This
	*   implementation covers the semver scheme and common aliases (`npm`, `cargo`,
	*   `golang`, etc.). Additional version schemes may be added as the spec
	*   matures.
	*
	* @see https://github.com/package-url/vers-spec
	*/
	const SEMVER_SCHEMES = (0, import_object.ObjectFreeze)(new import_map_set.SetCtor([
		"semver",
		"npm",
		"cargo",
		"golang",
		"hex",
		"pub",
		"cran",
		"gem",
		"swift"
	]));
	const WHITESPACE_PATTERN = /\s/;
	const RANGE_COMPARATORS = (0, import_object.ObjectFreeze)(new import_map_set.SetCtor([
		"<",
		"<=",
		">",
		">="
	]));
	const VERS_QUOTE_PATTERN = /[!*<=>|]/g;
	const VERS_QUOTE_MAP = (0, import_object.ObjectFreeze)(new import_map_set.MapCtor([
		["!", "%21"],
		["*", "%2A"],
		["<", "%3C"],
		["=", "%3D"],
		[">", "%3E"],
		["|", "%7C"]
	]));
	/**
	* URL-quote the separator/comparator characters of a version for canonical
	* VERS serialization.
	*/
	function quoteVersVersion(version) {
		return (0, import_string.StringPrototypeReplace)(version, VERS_QUOTE_PATTERN, (ch) => VERS_QUOTE_MAP.get(ch));
	}
	/**
	* Enforce the VERS canonical-form rules (spec: "Normalized, canonical
	* representation and validation") — a VERS string must arrive already
	* canonical; tools error instead of normalizing:
	*
	* 1. Versions are unique across all constraints, regardless of comparator.
	* 2. Constraints are sorted by version (verifiable only for schemes with a
	*    comparator — the semver schemes here).
	* 3. Ignoring `!=` constraints, an `=` constraint may be followed only by `=`,
	*    `>`, or `>=`.
	* 4. Ignoring `=` and `!=` constraints, the remaining comparators alternate: a
	*    lower bound (`>`/`>=`) is followed by an upper bound (`<`/`<=`) and vice
	*    versa.
	*/
	function validateCanonicalConstraints(scheme, constraints) {
		const seenVersions = new import_map_set.SetCtor();
		for (let i = 0, { length } = constraints; i < length; i += 1) {
			const c = constraints[i];
			if (c.comparator === "*") continue;
			if (seenVersions.has(c.version)) throw new PurlError(`vers versions must be unique: "${c.version}" occurs more than once`);
			seenVersions.add(c.version);
		}
		if (SEMVER_SCHEMES.has(scheme)) for (let i = 1, { length } = constraints; i < length; i += 1) {
			const prev = constraints[i - 1];
			const c = constraints[i];
			if (prev.comparator === "*" || c.comparator === "*") continue;
			if (compareSemver(c.version, prev.version) < 0) throw new PurlError(`vers constraints must be sorted by version: "${c.version}" follows "${prev.version}"`);
		}
		let prevComparator;
		for (let i = 0, { length } = constraints; i < length; i += 1) {
			const { comparator } = constraints[i];
			if (comparator === "!=" || comparator === "*") continue;
			if (prevComparator === "=" && comparator !== "=" && comparator !== ">" && comparator !== ">=") throw new PurlError(`vers "=" constraint may only be followed by "=", ">", or ">=" — saw "${comparator}"`);
			prevComparator = comparator;
		}
		let prevRange;
		for (let i = 0, { length } = constraints; i < length; i += 1) {
			const { comparator } = constraints[i];
			if (!RANGE_COMPARATORS.has(comparator)) continue;
			const isLower = comparator === ">" || comparator === ">=";
			if (prevRange !== void 0) {
				if ((prevRange === ">" || prevRange === ">=") === isLower) throw new PurlError(`vers range comparators must alternate between lower and upper bounds: "${comparator}" follows "${prevRange}"`);
			}
			prevRange = comparator;
		}
	}
	/**
	* VERS (VErsion Range Specifier) parser and evaluator.
	*
	* **Early adoption:** The VERS spec is pre-standard draft. This implementation
	* supports semver-based schemes (`npm`, `cargo`, `golang`, `gem`, etc.).
	* Additional version schemes may be added as the spec matures.
	*
	* @example
	*   ;```typescript
	*   const range = Vers.parse('vers:npm/>=1.0.0|<2.0.0')
	*   range.contains('1.5.0') // true
	*   range.contains('2.0.0') // false
	*   range.toString() // 'vers:npm/>=1.0.0|<2.0.0'
	*
	*   // Wildcard matches all versions
	*   Vers.parse('vers:semver/*').contains('999.0.0') // true
	*   ```
	*/
	var Vers = class Vers {
		scheme;
		constraints;
		constructor(scheme, constraints) {
			this.scheme = scheme;
			this.constraints = (0, import_object.ObjectFreeze)(constraints);
			(0, import_object.ObjectFreeze)(this);
		}
		/**
		* Parse a VERS string.
		*
		* @param versStr - VERS string (e.g., `'vers:npm/>=1.0.0|<2.0.0'`)
		*
		* @returns `Vers` instance
		*
		* @throws {PurlError} If the string is not a valid VERS
		*/
		static parse(versStr) {
			return Vers.fromString(versStr);
		}
		/**
		* Parse a VERS string.
		*
		* @param versStr - VERS string (e.g., `'vers:npm/>=1.0.0|<2.0.0'`)
		*
		* @returns `Vers` instance
		*
		* @throws {PurlError} If the string is not a valid VERS
		*/
		static fromString(versStr) {
			if (typeof versStr !== "string" || versStr.length === 0) throw new PurlError("vers string is required");
			if (!(0, import_string.StringPrototypeStartsWith)(versStr, "vers:")) throw new PurlError("vers string must start with \"vers:\" scheme");
			if ((0, import_regexp.RegExpPrototypeTest)(WHITESPACE_PATTERN, versStr)) throw new PurlError("vers string must not contain whitespace");
			const remainder = (0, import_string.StringPrototypeSlice)(versStr, 5);
			const slashIndex = (0, import_string.StringPrototypeIndexOf)(remainder, "/");
			if (slashIndex === -1 || slashIndex === 0) throw new PurlError("vers string must contain a version scheme before \"/\"");
			const scheme = (0, import_string.StringPrototypeToLowerCase)((0, import_string.StringPrototypeSlice)(remainder, 0, slashIndex));
			const constraintsStr = (0, import_string.StringPrototypeSlice)(remainder, slashIndex + 1);
			if (constraintsStr.length === 0) throw new PurlError("vers string must contain at least one constraint");
			const rawConstraints = (0, import_string.StringPrototypeSplit)(constraintsStr, "|");
			const MAX_CONSTRAINTS = 1e3;
			if (rawConstraints.length > MAX_CONSTRAINTS) throw new PurlError(`vers exceeds maximum of ${MAX_CONSTRAINTS} constraints`);
			const constraints = [];
			for (let i = 0, { length } = rawConstraints; i < length; i += 1) {
				const constraint = parseConstraint(rawConstraints[i]);
				if (constraint.comparator !== "*" && (0, import_string.StringPrototypeIncludes)(constraint.version, "%")) {
					(0, import_array.ArrayPrototypePush)(constraints, {
						...constraint,
						version: (0, import_globals.decodeURIComponent)(constraint.version)
					});
					continue;
				}
				(0, import_array.ArrayPrototypePush)(constraints, constraint);
			}
			if (constraints.length > 1) {
				for (let i = 0, { length } = constraints; i < length; i += 1) if (constraints[i].comparator === "*") throw new PurlError("wildcard \"*\" must be the only constraint");
			}
			if (SEMVER_SCHEMES.has(scheme)) for (let i = 0, { length } = constraints; i < length; i += 1) {
				const c = constraints[i];
				if (c.comparator !== "*" && !isSemverString(c.version)) throw new PurlError(`invalid semver version "${c.version}" in VERS constraint`);
			}
			validateCanonicalConstraints(scheme, constraints);
			return new Vers(scheme, constraints);
		}
		/**
		* Check if a version is contained within this VERS range.
		*
		* Implements the VERS containment algorithm for semver-based schemes.
		*
		* @param version - Version string to check.
		*
		* @returns `true` if the version matches the range
		*
		* @throws {PurlError} If the scheme is not supported
		*/
		contains(version) {
			if (!SEMVER_SCHEMES.has(this.scheme)) throw new PurlError(`unsupported VERS scheme "${this.scheme}" for containment check`);
			const { constraints } = this;
			if (constraints.length === 1 && constraints[0].comparator === "*") return true;
			for (let i = 0, { length } = constraints; i < length; i += 1) {
				const c = constraints[i];
				if (c.comparator === "!=" && compareSemver(version, c.version) === 0) return false;
			}
			for (let i = 0, { length } = constraints; i < length; i += 1) {
				const c = constraints[i];
				if (c.comparator === "=" && compareSemver(version, c.version) === 0) return true;
			}
			const ranges = [];
			for (let i = 0, { length } = constraints; i < length; i += 1) {
				const c = constraints[i];
				if (c.comparator !== "!=" && c.comparator !== "=") (0, import_array.ArrayPrototypePush)(ranges, c);
			}
			if (ranges.length === 0) return false;
			for (let i = 0, { length } = ranges; i < length; i += 1) {
				const c = ranges[i];
				const cmp = compareSemver(version, c.version);
				if (c.comparator === ">=") {
					if (cmp < 0) {
						const next = ranges[i + 1];
						if (next && (next.comparator === "<" || next.comparator === "<=")) i += 1;
						continue;
					}
					const next = ranges[i + 1];
					if (!next) return true;
					const cmpNext = compareSemver(version, next.version);
					if (next.comparator === "<" && cmpNext < 0) return true;
					if (next.comparator === "<=" && cmpNext <= 0) return true;
					i += 1;
				} else if (c.comparator === ">") {
					if (cmp <= 0) {
						const next = ranges[i + 1];
						if (next && (next.comparator === "<" || next.comparator === "<=")) i += 1;
						continue;
					}
					const next = ranges[i + 1];
					if (!next) return true;
					const cmpNext = compareSemver(version, next.version);
					if (next.comparator === "<" && cmpNext < 0) return true;
					if (next.comparator === "<=" && cmpNext <= 0) return true;
					i += 1;
				} else {
					const cmpVal = compareSemver(version, c.version);
					if (c.comparator === "<" && cmpVal < 0) return true;
					if (c.comparator === "<=" && cmpVal <= 0) return true;
				}
			}
			return false;
		}
		/**
		* Serialize to canonical VERS string.
		*/
		toString() {
			const parts = [];
			for (let i = 0, { length } = this.constraints; i < length; i += 1) {
				const c = this.constraints[i];
				if (c.comparator === "*") (0, import_array.ArrayPrototypePush)(parts, "*");
				else if (c.comparator === "=") (0, import_array.ArrayPrototypePush)(parts, quoteVersVersion(c.version));
				else (0, import_array.ArrayPrototypePush)(parts, `${c.comparator}${quoteVersVersion(c.version)}`);
			}
			return `vers:${this.scheme}/${(0, import_array.ArrayPrototypeJoin)(parts, "|")}`;
		}
	};
	/*!
	Copyright (c) the purl authors
	
	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:
	
	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.
	
	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
	*/
	/* v8 ignore stop */
	exports.Err = Err;
	exports.Ok = Ok;
	Object.defineProperty(exports, "PURL_Type", {
		enumerable: true,
		get: function() {
			return import_purl.PURL_Type;
		}
	});
	exports.PackageURL = PackageURL;
	exports.PurlBuilder = PurlBuilder;
	exports.PurlComponent = PurlComponent;
	exports.PurlError = PurlError;
	exports.PurlInjectionError = PurlInjectionError;
	exports.PurlQualifierNames = PurlQualifierNames;
	exports.PurlType = PurlType;
	exports.ResultUtils = ResultUtils;
	exports.UrlConverter = UrlConverter;
	exports.Vers = Vers;
	exports.comparePurls = comparePurls;
	exports.containsInjectionCharacters = containsInjectionCharacters;
	exports.createMatcher = createMatcher;
	exports.equalsPurls = equalsPurls;
	exports.err = err;
	exports.findInjectionCharCode = findInjectionCharCode;
	exports.formatInjectionChar = formatInjectionChar;
	exports.matchesPurl = matchesPurl;
	exports.ok = ok;
	exports.parseNpmSpecifier = parseNpmSpecifier;
	exports.splitPurlPackageName = splitPurlPackageName;
	exports.stringify = stringify;
	exports.stringifySpec = stringifySpec;
}));

//#endregion
//#region src/post.js
var import_dist = require_dist();
/**
* Render the firewall report left behind by the main step as a job summary.
*/
async function main() {
	if (getInput("mode", { required: true }).toLowerCase() === "patch") {
		info("patch mode: no post-run actions required");
		return;
	}
	const inputs = { jobSummary: getInput("job-summary", { required: false }).toLowerCase() };
	if (inputs.jobSummary === "true") inputs.jobSummary = "all";
	if (inputs.jobSummary === "false") inputs.jobSummary = "none";
	if (inputs.jobSummary === "none") {
		info("skipping firewall job summary");
		return;
	}
	if (!process.env.SFW_JSON_REPORT_PATH) {
		info("firewall report path not set");
		return;
	}
	let report;
	try {
		debug(`reading report json from ${process.env.SFW_JSON_REPORT_PATH}`);
		const json = await readFile(process.env.SFW_JSON_REPORT_PATH);
		report = JSON.parse(json);
	} catch (error) {
		if (error.code === "ENOENT") {
			info("no report output detected, skipping creation of job summary");
			return;
		}
		debug(JSON.stringify(error));
		setFailed("error importing report json");
		process.exit(1);
	}
	summary.addRaw("<h2>Socket Firewall Report</h2>");
	if (!report.blocked && !report.parseFail) {
		if (inputs.jobSummary === "errors") {
			info("no errors detected, skipping job summary");
			return;
		}
		summary.addRaw("Nothing to report :tada:", true);
	}
	if (report.blocked) {
		summary.addRaw("<h3>Blocked :x:</h3>", true);
		const headers = [
			{
				data: "Name",
				header: true
			},
			{
				data: "Version",
				header: true
			},
			{
				data: "Registry",
				header: true
			}
		];
		const rows = [];
		for (const p of report.blocked) {
			const { name, namespace, type, version } = import_dist.PackageURL.fromString(p.purlString);
			const fullName = namespace ? `${namespace}/${name}` : name;
			const link = `https://socket.dev/${type}/package/${fullName}/overview/${version}`;
			rows.push([
				`<a href="${link}">${fullName}</a>`,
				`<code>${version}</code>`,
				`<code>${p.registryFqdn}</code`
			]);
		}
		summary.addTable([headers, ...rows]);
	}
	if (report.parseFail) {
		summary.addRaw("<h3>URL Parse Failure :warning:</h3>", true);
		const headers = [{
			data: "URL",
			header: true
		}, {
			data: "Registry",
			header: true
		}];
		const rows = [];
		for (const p of report.parseFail) rows.push([`<code>${p.urlPath}</code>`, `<code>${p.registryFqdn}</code`]);
		summary.addTable([headers, ...rows]);
	}
	await summary.write();
}
main().catch((error) => {
	setFailed(`${error?.message ?? String(error)}`);
	process.exit(1);
});

//#endregion
export { main };