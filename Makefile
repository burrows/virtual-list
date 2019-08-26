NAME    = VirtualList
SOURCES = $(wildcard src/*.jsx)

default: spec

spec:
	./node_modules/.bin/karma start ./karma.config.js

package:
	./node_modules/.bin/webpack --mode production --output-filename pkg/$(NAME).js && cp pkg/$(NAME).js docs

watch:
	./node_modules/.bin/webpack --mode development --output-filename pkg/$(NAME).js --watch

clean:
	rm -rf ./pkg

.PHONY: $(NAME) default spec clean
