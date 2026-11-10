// npm does not run a package directory's prepublishOnly when publishing a .tgz.
// Keep publication manual, but make the validated artifact the normal route.
console.error("Publish the validated tarball, not the working directory.\nRun npm run release:prepare, then use the npm publish command it prints.");
process.exit(1);
