# Contributors

### Checkin

- Do checkin source (src)
- Do checkin a single index.js file after running `ncc`
- Do not checking node_modules

### NCC

In order to avoid uploading `node_modules` to the repository, we use [zeit/ncc](https://github.com/zeit/ncc) to create a single `index.js` file that gets saved in `dist/`.

If you're developing locally you can run
```
npm install
tsc
ncc build
```
You can also do
```
npm run-script build # runs tsc
npm run-script format # runs prettier --write
npm run-script format-check # runs prettier --check
npm run-script test # runs jest
npm run-script release # runs ncc build
```

Any files generated using `tsc` will be added to `lib/*`, however those files also are not uploaded to the repository and are excluded using `.gitignore`.

### Testing

Tests are included under `_tests_/*` and can be run using `npm run-script test`.

We ask that you include a link to a successful run that utilizes the changes you are working on. For example, if your changes are in the branch `newAwesomeFeature`, then show an example run that uses `setup-python@newAwesomeFeature` or `my-fork@newAwesomeFeature`. This will help speed up testing and help us confirm that there are no breaking changes or bugs.