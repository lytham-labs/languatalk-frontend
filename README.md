# LanguaTalk Frontend

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

LanguaTalk Frontend - Nx workspace with React Native/Expo mobile app for language learning platform.

## Project Structure

This is an Nx monorepo containing:
- **Mobile App** (`apps/mobile/`) - React Native/Expo mobile application
- **Web Frontend** (`apps/languatalk-frontend/`) - Web application (future)

## Prerequisites

- Node.js (version specified in `.nvmrc`)
- npm or yarn
- iOS development: Xcode and Xcode Command Line Tools
- Android development: Android Studio and Android SDK (optional)
- FontAwesome Pro access (see setup below)

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/lytham-labs/languatalk-frontend.git
cd languatalk-frontend

# Install root dependencies
npm install
```

### 2. FontAwesome Pro Setup

The mobile app uses FontAwesome Pro icons. You need to create an `.npmrc` file in the mobile directory with your FontAwesome Pro token:

```bash
# Navigate to mobile app directory
cd apps/mobile

# Create .npmrc file with your FontAwesome Pro token
cat > .npmrc << 'EOF'
@fortawesome:registry=https://npm.fontawesome.com/
@awesome.me:registry=https://npm.fontawesome.com/
//npm.fontawesome.com/:_authToken=YOUR_FONTAWESOME_TOKEN_HERE
EOF
```

**Replace `YOUR_FONTAWESOME_TOKEN_HERE` with your actual FontAwesome Pro token.**

### 3. Mobile App Setup

```bash
# Install mobile app dependencies (from apps/mobile directory)
npm install

# Install iOS dependencies (required for iOS)
cd ios
pod install
cd ..

# Return to project root
cd ../..
```

### 4. Environment Setup

Create environment files as needed:

```bash
# In the mobile app directory (apps/mobile/)
# Create .env.local with your environment variables
# Examples might include:
# API_URL=https://your-api-url.com
# SENTRY_DSN=your-sentry-dsn
# etc.
```

## Running the Mobile App

### iOS Development

```bash
# From project root - run iOS simulator
npx nx ios mobile

# Alternative: run from mobile directory
cd apps/mobile
npm run ios
```

### Android Development (Optional)

```bash
# From project root - run Android emulator
npx nx android mobile

# Alternative: run from mobile directory
cd apps/mobile
npm run android
```

### Development Server (Expo)

```bash
# Start Expo development server
npx nx start mobile

# Alternative: from mobile directory
cd apps/mobile
npm start
```

## Quick Setup (All Steps Combined)

For convenience, here's the complete setup:

```bash
# Clone and setup
git clone https://github.com/lytham-labs/languatalk-frontend.git
cd languatalk-frontend
npm install

# Setup FontAwesome Pro and mobile app
cd apps/mobile

# IMPORTANT: Replace YOUR_FONTAWESOME_TOKEN_HERE with your actual token
cat > .npmrc << 'EOF'
@fortawesome:registry=https://npm.fontawesome.com/
@awesome.me:registry=https://npm.fontawesome.com/
//npm.fontawesome.com/:_authToken=YOUR_FONTAWESOME_TOKEN_HERE
EOF

# Install dependencies and iOS pods
npm install
cd ios
pod install
cd ../..

# Ready to run!
npx nx ios mobile
```

## Troubleshooting

### iOS Build Issues

If you encounter iOS build issues:

1. **Clean and rebuild iOS dependencies:**
   ```bash
   cd apps/mobile/ios
   pod deintegrate
   pod install
   cd ..
   ```

2. **Clear Expo cache:**
   ```bash
   cd apps/mobile
   npx expo start --clear
   ```

3. **Reset Metro cache:**
   ```bash
   cd apps/mobile
   npx expo start --clear
   watchman watch-del-all  # if watchman is installed
   ```

### FontAwesome Pro Issues

If you encounter FontAwesome Pro authentication errors:
- Ensure you have a valid FontAwesome Pro subscription
- Check that your token is correctly placed in `apps/mobile/.npmrc`
- Try running `npm install` again in the `apps/mobile` directory

### React Native Version

- This project uses **React Native 0.74.5**
- Ensure all React Native related packages are compatible with this version

## Other Nx Tasks

To run the web dev server:

```sh
npx nx serve languatalk-frontend
```

To create a production bundle:

```sh
npx nx build languatalk-frontend
```

To see all available targets to run for a project, run:

```sh
npx nx show project mobile
npx nx show project languatalk-frontend
```

[More about running tasks in the docs &raquo;](https://nx.dev/features/run-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Add new projects

While you could add new projects to your workspace manually, you might want to leverage [Nx plugins](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) and their [code generation](https://nx.dev/features/generate-code?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) feature.

Use the plugin's generator to create new projects.

To generate a new application, use:

```sh
npx nx g @nx/react-native:app demo
```

To generate a new library, use:

```sh
npx nx g @nx/react:lib mylib
```

You can use `npx nx list` to get a list of installed plugins. Then, run `npx nx list <plugin-name>` to learn about more specific capabilities of a particular plugin. Alternatively, [install Nx Console](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) to browse plugins and generators in your IDE.

[Learn more about Nx plugins &raquo;](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) | [Browse the plugin registry &raquo;](https://nx.dev/plugin-registry?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)


[Learn more about Nx on CI](https://nx.dev/ci/intro/ci-with-nx#ready-get-started-with-your-provider?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Install Nx Console

Nx Console is an editor extension that enriches your developer experience. It lets you run tasks, generate code, and improves code autocompletion in your IDE. It is available for VSCode and IntelliJ.

[Install Nx Console &raquo;](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Useful links

Learn more:

- [Learn more about this workspace setup](https://nx.dev/nx-api/react-native?utm_source=nx_project&amp;utm_medium=readme&amp;utm_campaign=nx_projects)
- [Learn about Nx on CI](https://nx.dev/ci/intro/ci-with-nx?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Releasing Packages with Nx release](https://nx.dev/features/manage-releases?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [What are Nx plugins?](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

And join the Nx community:
- [Discord](https://go.nx.dev/community)
- [Follow us on X](https://twitter.com/nxdevtools) or [LinkedIn](https://www.linkedin.com/company/nrwl)
- [Our Youtube channel](https://www.youtube.com/@nxdevtools)
- [Our blog](https://nx.dev/blog?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)