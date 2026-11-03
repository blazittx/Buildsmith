# Buildsmith

[![Netlify Status](https://api.netlify.com/api/v1/badges/3fb89cbf-7c8b-4bfd-b317-57c092ef108b/deploy-status)](https://app.netlify.com/projects/buildsmith/deploys)

![Buildsmith Landing Page](https://github.com/user-attachments/assets/7937eec6-a1cd-4ee3-b225-43ca83035f3e)

**Buildsmith** is your free one-click deployment tool for indie games. Connect your GitHub repository and Buildsmith packages your latest build, uploads it to the cloud, and notifies your team automatically—no more emailing zip files. Built with **Electron**, it handles updates, CI/CD pipelines, and cloud storage so you can focus on development.

## Features

### 📦 One-Click GitHub Deployments

<div style="display: flex; align-items: center;">
  <div style="flex: 1; padding-right: 20px;">
    Deploy your Unity game straight from your GitHub repository with a single click. Buildsmith packages your latest build and uploads it for free, so your testers always have the most recent version.
  </div>
  <img src="https://via.placeholder.com/500" alt="One-Click Deploy" style="max-width: 45%;">
</div>

### 🚀 Auto Updates

<div style="display: flex; align-items: center;">
  <div style="flex: 1; padding-right: 20px;">
    The launcher uses GitHub Actions and releases to automatically update clients to the latest version upon launch, ensuring all users have the latest features and security updates.
  </div>
  <img src="https://via.placeholder.com/500" alt="Auto Updates" style="max-width: 45%;">
</div>

### 🎮 Dynamic Game Addition

<div style="display: flex; align-items: center;">
  <div style="flex: 1; padding-right: 20px;">
    Games can be added and updated through a database backend, with changes reflecting immediately in the launcher. Game cards are automatically created in the UI, complete with download buttons based on unique game IDs.
  </div>
  <div style="display: flex; justify-content: space-between; width: 50%;">
    <img src="https://github.com/user-attachments/assets/2ee2370a-2c17-4418-8df3-b4e49ee89d23" width="48%" />
    <img src="https://github.com/user-attachments/assets/d36cce86-bdbd-4ef6-b1bb-5093ab5f48ef" width="48%" />
  </div>
</div>

### 🔄 CI/CD Integration

<div style="display: flex; align-items: center;">
  <div style="flex: 1; padding-right: 20px;">
    Support for continuous integration and delivery with GitHub Actions for Unity projects. Automatically builds and uploads game files to Oracle Cloud buckets, facilitating seamless updates and distribution.
  </div>
  <img src="https://via.placeholder.com/500" alt="CI/CD Integration" style="max-width: 45%;">
</div>

### 💾 Flexible Storage Solutions

<div style="display: flex; align-items: center;">
  <div style="flex: 1; padding-right: 20px;">
    While the launcher integrates seamlessly with Oracle Cloud for storing game builds, it also allows manual uploads to any cloud storage service, offering flexibility for different deployment needs.
  </div>
  <img src="https://via.placeholder.com/500" alt="Flexible Storage Solutions" style="max-width: 45%;">
</div>

### 🎨 Customizable UI

<div style="display: flex; align-items: center;">
  <div style="flex: 1; padding-right: 20px;">
    The UI is designed to be highly customizable, allowing developers to tailor the launcher to match their branding and aesthetic preferences.
  </div>
  <img src="https://via.placeholder.com/500" alt="Customizable UI" style="max-width: 45%;">
</div>

### 📊 Playtime Tracking

<div style="display: flex; align-items: center;">
  <div style="flex: 1; padding-right: 20px;">
    Buildsmith records how long each game is played, giving you insight into tester engagement and helping prioritize updates.
  </div>
  <img src="https://via.placeholder.com/500" alt="Playtime Tracking" style="max-width: 45%;">
</div>
## Installation

To get started with **Buildsmith**, follow the instructions below.

[Download the Latest Release Here](https://github.com/blazittx/Buildsmith/releases/latest)

### Clone the Repo

```bash
# Example command to clone the repo
git clone https://github.com/blazittx/Buildsmith.git
```

## License

Buildsmith is distributed under the **Doruk Sasmaz Non-Commercial License (DSNC 1.0)**.
This means you are free to use, modify, and merge the software for personal or
academic projects but **commercial use and distribution are not allowed**.
See [Licence.txt](./Licence.txt) for the full license text and details.
