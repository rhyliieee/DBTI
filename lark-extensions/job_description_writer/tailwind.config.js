module.exports = {
    content: [
      "./src/**/*.{js,jsx,ts,tsx}",
      "./public/index.html"
    ],
    theme: {
      extend: {
        colors: {
          'accent-green-light': '#37A533',
          'accent-green-dark': '#1E651C',
        },
        fontFamily: {
          'panton': ['Panton Bold', 'sans-serif'],
          'quicksand': ['Quicksand', 'sans-serif'],
        },
      },
    },
    plugins: [],
  }