# Contributors

### Checkin

- Do checkin source (src)
- Do checkin a single index.js file after running `ncc`
- Do not checking node_modules

### NCC

In order to avoid uploading `node_modules` to the repository, we use [zeit/ncc](https://github.com/zeit/ncc) to create multiple `index.js` files that gets saved under `dist/`.
There are two main files that get created
- `dist/setup/index.js`
   - Core `setup-java` logic that downloads and installs an appropriate version of Java 
   - Handling creating a `settings.xml` file to make it easier to publish packages
- `dist/cleanup/index/js`
   -  Extra cleanup script that is used to remove GPG keys (needed for certain self-hosted runner scenarios)

If you're developing locally, after doing `npm install`, you can use the following commands
```yaml
npm run build # runs tsc along with ncc
npm run format # runs prettier --write
npm run format-check # runs prettier --check
npm run test # runs jest
npm run release # add all the necessary ncc files under dist/* to the git staging area
```

Any files generated using `tsc` will be added to `lib/*`, however those files also are not uploaded to the repository and are excluded using `.gitignore`.

### Testing

Tests are included under `_tests_/*` and can be run using `npm run-script test`.

We ask that you include a link to a successful run that utilizes the changes you are working on. For example, if your changes are in the branch `newAwesomeFeature`, then show an example run that uses `setup-python@newAwesomeFeature` or `my-fork@newAwesomeFeature`. This will help speed up testing and help us confirm that there are no breaking changes or bugs.