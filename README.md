# 🐸 Toad's Life - 3D Browser Survival Game

[![official JetBrains project](http://jb.gg/badges/official.svg)](https://confluence.jetbrains.com/display/ALL/JetBrains+on+GitHub) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
<a href="https://www.coursera.org/learn/jb-build-game-with-ai-agent/" target="_blank">
<img src="https://img.shields.io/badge/Coursera-0056D2?style=for-the-badge&logo=Coursera&logoColor=white&style=flat" alt="Course%20catalog"></a>
<a href="https://plugins.jetbrains.com/plugin/30327-build-a-game-with-ai-coding-agent/versions" target="_blank">
<img src="https://img.shields.io/badge/dynamic/yaml?query=%24.course_version&url=https://raw.githubusercontent.com/jetbrains-academy/game-course/refs/heads/main/course-remote-info.yaml&logo=jetbrains&logoColor=FC801D&label=Marketplace&color=6b59fe&style=flat&prefix=v" alt="Marketplace"></a>

A fully-featured 3D survival game built with Three.js, featuring dynamic difficulty scaling, procedural generation, and advanced game mechanics. Control Tode the Frog as you navigate a hostile world filled with enemies, using strategic movement and well-timed attacks to survive as long as possible.

> Built as part of the JetBrains Academy course "Build a Game with an AI Coding Agent" - a project-based learning experience using AI coding agents inside WebStorm.

## 🎯 Play Now

**[Play Toad's Life](https://Gautam1201.github.io/Toad-game/)** - Live demo hosted on GitHub Pages

## 🎮 Game Features

- **3D Graphics**: Fully rendered 3D world using Three.js and WebGL
- **Dynamic Difficulty**: Adaptive AI that scales enemy speed, spawn rate, and player abilities based on performance
- **Strategic Gameplay**: Balance survival (passive scoring) with combat (active scoring) for optimal results
- **Procedural Generation**: Randomly placed obstacles using rejection sampling algorithms
- **Smooth Controls**: Frame-rate independent physics with input buffering for responsive gameplay
- **Visual Feedback**: Attack indicators, cooldown displays, and floating damage numbers
- **Isometric Camera**: Smooth camera follow system with cinematic perspective

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd Toad-game

# Install root dependencies (for testing)
npm install

# Navigate to game directory and install dependencies
cd game
npm install
```

### Running the Game

```bash
# Start development server
cd game
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The game will be available at `http://localhost:5173` (or the port shown in your terminal).

### Deploying to GitHub Pages

The game is automatically deployed to GitHub Pages when you push to the main branch.

**Manual deployment:**

```bash
cd game
npm run build
# The built files will be in game/dist/
```

The GitHub Actions workflow (`.github/workflows/deploy.yml`) handles automatic deployment. 

## 🕹️ How to Play

- **Arrow Keys**: Move Tode in four directions (hop-based movement)
- **Spacebar**: Attack enemies within your attack radius
- **Goal**: Survive as long as possible and maximize your score

### Scoring System

- **Survival**: +0.1 points per second
- **Kills**: +10 points per enemy defeated

### Game Mechanics

- Enemies continuously spawn and chase the player
- Difficulty increases as your score rises (faster enemies, shorter spawn delays)
- Houses provide strategic cover but also create obstacles
- Attack radius and cooldown improve with higher scores
- Colliding with enemies triggers game over

## 🛠️ Tech Stack

| Technology | Purpose |
|-----------|---------|
| **Three.js** | 3D rendering engine |
| **Vite** | Build tool and dev server |
| **WebGL** | GPU-accelerated graphics |
| **JavaScript (ES6+)** | Core programming language |
| **GLTF/GLB** | 3D model format |
| **Jest** | Unit testing |

## 📚 Project Structure

```
Toad-game/
├── game/                    # Main game application
│   ├── src/
│   │   ├── main.js         # Game loop & orchestration
│   │   ├── components/     # Game entities (Player, Enemy, House, etc.)
│   │   └── utils/          # Collision detection algorithms
│   ├── public/             # Static assets (3D models, icons)
│   └── package.json
└── README.md               # This file
```

## 📖 Documentation

An in-depth technical analysis includes:
- Game theory concepts (Dynamic Difficulty Adjustment, Risk-Reward mechanics)
- Advanced programming techniques (Frame-rate independence, Collision detection)
- Performance optimizations (Object pooling, Resource management)
- Mathematical foundations (Linear interpolation, Parabolic motion)

## 🎓 About This Project

This game was developed as part of the **JetBrains Academy** course "Build a Game with an AI Coding Agent". The course teaches game development fundamentals while demonstrating how to effectively collaborate with AI coding assistants.

### Learning Outcomes

- Component-based game architecture
- 3D graphics programming with Three.js
- Real-time physics simulation
- Procedural content generation
- Performance optimization techniques
- Frame-rate independent game loops

## 🤝 Want to Know More?

If you have questions about the course or find any errors, feel free to participate in discussions within the original repository [issues](https://github.com/jetbrains-academy/game-course/issues).

For questions about this specific implementation, feel free to open an issue in this repository.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- JetBrains Academy for the comprehensive course structure
- Three.js community for excellent documentation and examples
- Original course framework: [game-course](https://github.com/jetbrains-academy/game-course)

---

**Course Information**: [Coursera - Build a Game with an AI Coding Agent](https://www.coursera.org/learn/jb-build-game-with-ai-agent/)

**Contributing Guidelines**: [JetBrains Academy Contributing Guidelines](https://github.com/jetbrains-academy/.github/blob/main/contributing_guidelines.md)
