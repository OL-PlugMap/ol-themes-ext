// This file builds the packages in the mono repo
// The packages are in the src directory
// For each package we will need to run rollup to build the package

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import glob from 'glob';
import { rollup } from 'rollup';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import esbuild from 'rollup-plugin-esbuild';
import copy from 'rollup-plugin-copy';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import {nodeExternalsPlugin} from 'esbuild-node-externals';

import * as packageJSON from '../package.json' with { type: "json" };

// This function is used as a rollup plugin to transform package.json files
// to fix dependencies. Dependencies for the internal packages start with
// @timmons-group/. We want to update the version of the dependency to
// Match the version of the package we are building. We also want to change
// the dependency to a file dependency. This is because we are building
// all of the packages at the same time and we want to use the local
// version of the package instead of the version from npm.

// Read the package.json in the build directory and update the dependencies
const getMainVersion = (packageJson) => {
    const version = packageJson.version;
    return version;
};

const mainVersion = getMainVersion(packageJSON.default);
console.log('mainVersion', mainVersion);

// //  If we are not in the timmons-group folder cd into it
// if (!process.cwd().endsWith('timmons-group')) {
//     process.chdir('timmons-group');
// }


// Log our CWD
console.log('CWD:', process.cwd());

const packageJsonTransform = (contents, id) => {
    const code = contents;
    if (id.endsWith('package.json')) {
        const packageJson = JSON.parse(code);
        for (const [key, value] of Object.entries(packageJson.dependencies || {})) {
            if (key.startsWith('@timmons-group/')) {
                packageJson.dependencies[key] = `${mainVersion}`;
            }
        }
        for (const [key, value] of Object.entries(packageJson.peerDependencies || {})) {
            if (key.startsWith('@timmons-group/')) {
                packageJson.dependencies[key] = `${mainVersion}`;
            }
        }

        // Now set the version to the main version
        packageJson.version = mainVersion;

        // And add a module field with the value being the main file with the .js extension
        packageJson.module = packageJson.main.replace(/\..*$/, '.js');

        return JSON.stringify(packageJson, null, 2);
    }
};

const replaceFileDependencies = () => ({
    name: 'replace-file-dependencies',
    async transform(code, id) {
        if (id.endsWith('package.json', code)) {
            console.log("Parsing package.json file", id);
            try {
                const packageJson = JSON.parse(code);
                for (const [key, value] of Object.entries(packageJson.dependencies)) {
                    if (key.startsWith('@timmons-group/')) {
                        packageJson.dependencies[key] = `${mainVersion}`;
                    }
                }
                return JSON.stringify(packageJson, null, 2);
            }
            catch {
                console.log("Error parsing package.json file", id);
                console.log("Code: ", code);
                console.log("ID: ", id);
                throw new Error("Error parsing package.json file");
            }
        }
    }
});

const updateExportsToJS = () => ({
    name: 'update-exports-to-js',
    async transform(code, id) {
        if (id.endsWith('package.json')) {
            try {
                const packageJson = JSON.parse(code);
                packageJson.exports = packageJson.exports || {};

                // Get the exports and change anything that ends in .js, .jsx, .ts, .tsx to .mjs
                for (const [key, value] of Object.entries(packageJson.exports)) {
                    const newKey = key.replace(/\.(js|jsx|mjs|ts|tsx)$/, '.js');
                    const newValue = value.replace(/\.(js|jsx|mjs|ts|tsx)$/, '.js');
                    packageJson.exports[newKey] = newValue;

                }
                return JSON.stringify(packageJson, null, 2);
            } catch (e) {
                console.error("Error parsing package.json file", id);
                console.log("Error parsing package.json file", id);
                console.log("Code: ", code);
                console.log("ID: ", id);
                throw new Error("Error parsing package.json file");
            }
        }
    }
});

const allTransforms = (contents, id) => {
    let code = contents;
    code = packageJsonTransform(code, id);
    code = updateExportsToJS().transform(code, id);
    return code;
};

const nullTransform = (contents) => {
    return contents;
};

const input = Object.fromEntries(
    glob
        .sync('src/**/*')
        // Only include files ending with .js, .jsx, .ts, and .tsx
        .filter(file => /\.(js|jsx|ts|tsx|mjs)$/.test(file))
        .map(file => [
            // This remove `src/` as well as the file extension from each
            // file, so e.g. src/nested/foo.js becomes nested/foo
            path.relative(
                'src',
                file.slice(0, file.length - path.extname(file).length)
            ),
            // This expands the relative paths to absolute paths, so e.g.
            // src/nested/foo becomes /project/src/nested/foo.js
            fileURLToPath(new URL(file, import.meta.url)),

        ])
);

console.log(input)

// For each of the packages in the src we need to grab the package.json file so that we can gather the peer dependencies
// and add them to the external list. This is because we are building the packages in the src directory and we want to
// use the local version of the package instead of the version from npm.
const packageJsonFiles = glob.sync('./src/package.json');

const windowsToUnix = (file) => {
    return file.replace(/\\/g, '/').replace(/^[a-zA-Z]:\//, '/');
};

const buildConfig = (packageJsonPath) => {
    console.log("Building package", packageJsonPath);
    // Get the folder for the packageJsonPath
    const packageFolder = path.dirname(packageJsonPath);
    const readmePath = windowsToUnix(path.resolve(packageFolder, 'README.md'));

    // Find the entry point for the package
    // For the input we need to use either the entry from the package.json file or the index.something file

    // Read the package.json file
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    const peerDeps = Object.keys(packageJson.peerDependencies || {});
    console.log("Peer dependencies", peerDeps);

    let entryFile = packageJson.main;

    // If the main file is not set in the package.json file then we will need to find the index file
    if (!entryFile) {
        const indexFiles = glob.sync(`${packageFolder}/index.*`);
        if (indexFiles.length > 0) {
            entryFile = path.relative(packageFolder, indexFiles[0]);
        }
    } else {
        entryFile = packageFolder + '/' + entryFile;
    }


    // For the output we want to have the files in the same folder as the package.json file without the leading src
    const outputFolder = path.relative('src', packageFolder);

    // In order for rollup to obey the exports field in the package.json file we need to set the output format to es
    // and set preserveModules to true. This will keep the directory structure of the package in the build directory.
    const rootPath = path.resolve(".", packageFolder);

    const all = glob
    .sync(`${rootPath}/**/*`, { ignore: ['**/node_modules/**'] });

    console.log("All files", all, rootPath);

    const filtered =  all
    // Only include files ending with .js, .jsx, .ts, and .tsx
    .filter(file => /\.(js|jsx|ts|tsx|mjs)$/.test(file))

    const inFiles = filtered
    .map(file => [
        // This remove `src/` as well as the file extension from each
        // file, so e.g. src/nested/foo.js becomes nested/foo
        path.relative(
            `src/${outputFolder}`,
            file
        )
        //Remove the extension
        .replace(path.extname(file), ''),
        // This expands the relative paths to absolute paths, so e.g.
        // src/nested/foo becomes /project/src/nested/foo.js
        fileURLToPath(new URL(windowsToUnix(file), windowsToUnix(import.meta.url))),
    ]);

    const input = Object.fromEntries(inFiles);
    console.log("Input files", input);

    // We also need to disable treeshaking by setting exports to auto and interop to auto
    // more info here: https://rollupjs.org/guide/en/#outputexports
    const ret = {
        input,
        output:
        {
            dir: `build/${outputFolder}`,
            format: 'es',
            entryFileNames: '[name].js',
            chunkFileNames: '[name]-[hash].js',
            sourcemap: true,
            assetFileNames: '[name][extname]',
            preserveModules: true,
            exports: 'named',
            interop: 'auto',
        },
        plugins: [
            peerDepsExternal({
                packageJsonPath,
                includeDependencies: true,
            }),
            resolve({
                extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs'],
                preferBuiltins: true,
                moduleDirectories: ['src', 'node_modules'],
                allowExportsFolderMapping: true,
                rootDir: rootPath,
                preserveModules: true,
                ignore: ['**/node_modules/**'],
            }),
            esbuild({
                // All options are optional
                include: /\.[jt]sx?$/, // default, inferred from `loaders` option
                exclude: /node_modules/, // default
                sourceMap: true, // default
                minify: false, //process.env.NODE_ENV === 'production',
                target: 'esnext', // default, or 'es20XX', 'esnext'
                define: {
                    __VERSION__: '"x.y.z"'
                },
                // Add extra loaders
                loaders: {
                    // Enable JSX in .js files too
                    '.js': 'jsx',
                    '.ts': 'tsx',
                    // And md files should be copied as text
                    '.md': 'text'

                },
            }),
            commonjs(),
            replaceFileDependencies(),
            updateExportsToJS(),
            nodeExternalsPlugin(),
            copy({
                targets: [
                     { src: packageJsonPath, dest: `build/${outputFolder}`, transform: allTransforms },
                     {src: readmePath, dest: `build/${outputFolder}`, transform: nullTransform },
                ],
                ignore: ['**/node_modules/**'],
            }),


        ],
        external: [
            ... peerDeps,
            "ol/*",
            "ol/format/WKT.js",
            "ol-ext/*",
            "ol/format/WKT.js",
            /^node_modules\//,
        ],
    };

    return ret;
};



const build = (config) => {
    rollup(config).then((bundle) => {
        return bundle.write(config.output);
    }).catch((error) => {
        console.error(error);
    });
};

const configs = packageJsonFiles.map(buildConfig);
console.log(configs);

for (const config of configs) {
    build(config);
}