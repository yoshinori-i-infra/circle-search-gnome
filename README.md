# 🎨 Circle to Search for GNOME (Go & GTK4 / Cairo)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

Androidの「**Circle to Search（かこって検索）**」機能を Linux (GNOME Desktop) 環境向けに再現したCLI/デスクトップユーティリティツールです。

画面の気になる部分をマウスドラッグで囲むだけで、高精細スクショから対象領域を即座に切り抜き、AI（今ポートフォリオではGoogle社のAntigravity）が内容を日本語で自動解析・解説します。

![Circle to Search Demo](./assets/demo.gif)     
---

## 🌟 主な特徴

- **囲み選択 UI (GTK4 + Cairo)**
  - GJS (GNOME JavaScript) を使用し、全画面オーバーレイを搭載。
- **超高速な画面キャプチャ (DBus / GNOME Shell Extension)**
  - 自作の GNOME Shell Extension を介して DBus 経由で直接キャプチャ指示を送るため、撮影権限ダイアログなしで瞬時にスクリーンショットを取得。
- **テスタブル & 拡張性の高いアーキテクチャ**
  - **SOLID原則（DIP / OCP）** に沿ったインターフェース設計を採用。外部依存（DBus、GUI、AI CLI）を分離・モック化し、単体テストも付属。
- **マルチ LLM / AI プロバイダー対応設計**
  - AI解析部はメインのコードを変更することなく  `ローカルLLM` や `OpenAI` などのプロバイダーへ拡張・切り替えが可能。

---

## 🏗 アーキテクチャ & 設計思想

本ポートフォリオは、**保守性・テスト容易性・拡張性** を備えた製品レベルのコード設計を意識して作成しました。

### 🔄 処理フロー

```
[ 1. キャプチャ ]  DBus 経由で GNOME Shell Extension が全画面ショットを取得
       │
[ 2. 囲みUI ]     GTK4/Cairo (gjs) 全画面オーバーレイ起動。ドラッグで範囲指定
       │
[ 3. 切り抜き ]   指定座標に基づき Go の image パッケージでサブ画像を切り抜き
       │
[ 4. AI解析 ]     agy の AI アナライザーが画像を認識して解説
```

### 💎 設計のポイント

1. **Dependency Inversion Principle (依存性逆転の原則)**
   - `Capturer`, `Runner`, `Cropper`, `Analyzer` の各インターフェースを規定することで、メインコードを含めた全体のメンテナンス性や拡張性を高めています。

2. **テスト容易性 (Testability)**
   - OSや外部ツールに強く依存する構成ですが、インターフェース化とモック構造体 (`MockAnalyzer` 等) の用意により、CI/CD環境やGUIのない環境でも単体テスト (`go test`) が付属されています。

3. **プロトタイプからのリファクタリング**
   - 本作は1ファイル（150行程度）のプロトタイプから着手し、動くことを確認した後にパッケージ分割を行っています。

---

## 📁 ディレクトリ構造

```
my-circle-search/
├── main.go               # アプリケーションオーケストレーター & DIコンテナ
├── main_test.go          # パイプライン全体の単体テスト (モック使用)
├── go.mod / go.sum       # Go モジュール定義
│
├── pkg/                  # コアバックエンドロジック
│   ├── analyzer/         # AI解析モジュール (Analyzer インターフェース, agy, mock)
│   ├── capture/          # DBus キャプチャモジュール (Capturer インターフェース)
│   ├── crop/             # 画像切り抜きモジュール (Cropper インターフェース)
│   ├── ui/               # GJS オーバーレイ起動モジュール (Runner インターフェース)
│   └── errors/           # ドメイン固有のセンチネルエラー定義
│
├── ui/
│   └── overlay.js        # GTK4 / Cairo による描画エフェクト付きオーバーレイ画面 (GJS)
│
└── extension/            # GNOME Shell 拡張機能 (キャプチャ用 DBus エンドポイント)
    ├── extension.js
    └── metadata.json
```

---

## 🛠 動作環境 & 依存関係

### 前提条件
- **OS**: Linux (GNOME Shell 45 以降推奨)
- **Go**: 1.26 以上
- **GJS / GTK4**: `gjs`, `gtk4`, `gdk-pixbuf2`
- **AI CLI**: `agy` (Google Antigravity Gemini CLI)

---

## 🚀 使い方

### 1. 依存ライブラリのインストール
```bash
go mod download
```

### 2. アプリケーションの実行
```bash
go run main.go
```

1. コマンドを実行すると自動で画面がキャプチャされ、オーバーレイ画面が全画面表示されます。
2. マウスで気になる部分を円を描くように囲みます（`Esc` キーでキャンセル）。
3. 選択を解除すると自動で切り抜かれ、ターミナル上に AI の解析結果が表示されます。

---

## 🧪 テストの実行

モックを使用したユニットテストを実行します。外部依存（`gjs` や `agy`）がない環境でも安全に動作確認できます。

```bash
go test -v ./...
```

---

## 🚀 今後挑戦したいこと・拡張アイデア                                                             

 +  本ポートフォリオを 今後さらに実用性を高めるための拡張案は以下です。
                                                                                                  
 - [ ] **ローカルLLMへの対応 (`LlamaCppAnalyzer`)**
   - `llama.cpp` (CLI / サーバー) と連携し、完全オフライン環境でのマルチモーダル解析に対応          
 - [ ] **デスクトップ通知（`notify-send`）連携**
   - ターミナルを開かずに、DBus / OS通知経由で解析結果をクイック確認                                
 - [ ] **設定ファイル（YAML/JSON）対応**
   - プロンプトテンプレートや使用モデル、保存先キャッシュパス等を柔軟にカスタマイズ可能にする

---

## 📄 ライセンス

本プロジェクトは [MIT License](./LICENSE) のもとで公開されています。
