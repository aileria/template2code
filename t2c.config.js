module.exports = {
    templateDir: './templates',
    generationDir: './generated',
    colors: {
        reset: '\x1b[0m',
        templateName: "\x1b[35m",
        placeholderName: "\x1b[36m",
        success: "\x1b[32m",
        error: "\x1b[31m",
    },
    placeholder: {
        start: '{{',
        end: '}}',
    },
}