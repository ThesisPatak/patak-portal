# GitHub Actions APK Build Setup

## Quick Start

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Add GitHub Actions APK build workflow"
   git push origin main
   ```

2. **Add EXPO_TOKEN secret to GitHub**
   - Go to your GitHub repository
   - Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `EXPO_TOKEN`
   - Value: Get your token by running:
     ```bash
     eas credentials show
     ```
     Or create one at https://expo.dev/settings/tokens

3. **Trigger the build**
   - The workflow will automatically run when you push to main/master/develop
   - Or manually trigger it:
     - Go to Actions tab → "Build Android APK" → Run workflow

4. **Download your APK**
   - Wait for the workflow to complete
   - Go to the workflow run
   - Scroll down to "Artifacts" section
   - Download the `android-apk` artifact

## What the workflow does:
✅ Runs on Linux (no Windows permission issues)
✅ Installs dependencies
✅ Builds APK using EAS CLI
✅ Uploads APK as artifact
✅ Stores for 30 days

## Troubleshooting

If the build fails:
1. Check the workflow logs in GitHub Actions
2. Make sure EXPO_TOKEN is set correctly
3. Verify your Expo account is valid
4. Check that app.json and eas.json are properly configured

## Manual trigger without push:
1. Go to Actions tab
2. Select "Build Android APK"
3. Click "Run workflow"
4. Select your branch
5. Click "Run workflow"
