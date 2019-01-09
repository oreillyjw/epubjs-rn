import React, { Component } from 'react';
import {
  AppRegistry,
  StyleSheet,
  Text,
  View,
  Animated,
  Modal,
  StatusBar,
  SafeAreaView
} from 'react-native';

import { Epub, Streamer, Rendition } from "epubjs-rn";

import TopBar from './app/TopBar'
import BottomBar from './app/BottomBar'
import Nav from './app/Nav'

const epubCFI = require('./node_modules/epubjs/lib/epubcfi');
const locationsCFI = require('./node_modules/epubjs/lib/locations');
import { sprint } from "./node_modules/epubjs/lib/utils/core";

class EpubReader extends Component {
  constructor(props) {
    super(props);
    this.state = {
      flow: "paginated", // paginated || scrolled-continuous
      location: 6,
      url: "https://s3.amazonaws.com/epubjs/books/moby-dick.epub",
      src: "",
      origin: "",
      title: "",
      toc: [],
      showBars: true,
      showNav: false,
      sliderDisabled: true
    };
    this.epub = undefined;
    this.streamer = new Streamer();
  }

  componentDidMount() {
    this.streamer.start()
      .then((origin) => {
        this.setState({origin})
        return this.streamer.get(this.state.url);
      })
      .then((src) => {
        return this.setState({src});
      });

    setTimeout(() => this.toggleBars(), 1000);
  }

  componentWillUnmount() {
    this.streamer.kill();
  }

  toggleBars() {
    this.setState({ showBars: !this.state.showBars });
  }

  findQuery(itemObject, _query) {
    var section = itemObject;
		var matches = [];
		var query = _query.toLowerCase();
		var find = function(node){
			var text = node.textContent.toLowerCase();
			var range = locationsCFI.prototype.createRange();
			var cfi;
			var pos;
			var last = -1;
			var excerpt;
			var limit = 100;

			while (pos != -1) {
				// Search for the query
				pos = text.indexOf(query, last + 1);
				if (pos != -1) {
					// We found it! Generate a CFI
          range = locationsCFI.prototype.createRange();

          range.startContainer = node;
					range.startOffset = pos;
          range.endContainer = node;
          range.endOffset = pos + query.length;

					cfi = section.cfiFromRange(range);

					// Generate the excerpt
					if (node.textContent.length < limit) {
						// excerpt = node.textContent;
            excerpt = "..." + node.textContent.substring(0,pos)
                        + "<span class='highlight'>"
                            + node.textContent.substring(pos,pos+query.length)
                        + "</span>"
                      + node.textContent.substring(pos+query.length, node.textContent.length) + "...";
					}
					else {
            excerpt = "..." + node.textContent.substring(pos - limit/2,pos)
                        + "<span class='highlight'>"
                            + node.textContent.substring(pos,pos+query.length)
                        + "</span>"
                      + node.textContent.substring(pos+query.length, pos + limit/2) + "...";
					}

					// Add the CFI to the matches list
					matches.push({
						cfi: new epubCFI(cfi),
						excerpt: excerpt
					});
				}

				last = pos;
			}
		};

		sprint(itemObject.document, function(node) {
			find(node);
		});

		return matches;
  }

  doSearch(q) {
    return Promise.all( this.state.book.spine.spineItems
          .map(item => item.load(this.state.book.load.bind(this.state.book))
                  .then(section => {

                    return this.findQuery(item, q);
                  })
                  .catch(err => err)
                  .then(res => {
                    item.unload.bind(item)
                    return res;
                  }))
    ).then(results => Promise.resolve([].concat.apply([], results)));
  }

  render() {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar hidden={!this.state.showBars}/>
        <Epub style={styles.reader}
              ref={(pub) => {
                this.epub = pub;
                console.log(this.epub)
              }}
              //src={"https://s3.amazonaws.com/epubjs/books/moby-dick.epub"}
              src={this.state.src}
              flow={this.state.flow}
              location={this.state.location}
              onLocationChange={(visibleLocation)=> {
                console.log("locationChanged", visibleLocation)
                this.setState({visibleLocation});
              }}
              onLocationsReady={(locations)=> {
                // console.log("location total", locations.total);
                this.setState({sliderDisabled : false});
              }}
              onReady={(book)=> {
                // console.log("Metadata", book.package.metadata)
                // console.log("Table of Contents", book.toc)
                this.setState({
                  title : book.package.metadata.title,
                  toc: book.navigation.toc,
                  book: book
                });
                // this.doSearch("moby").then(res => {
                //   console.log("result");
                //   console.log(res);
                // }
                // );
              }}
              onPress={(cfi, position, rendition)=> {
                console.log();
                this.toggleBars();
                console.log("press", cfi);
              }}
              onLongPress={(cfi, rendition)=> {
                console.log("longpress", cfi);
              }}
              onViewAdded={(index) => {
                console.log("added", index)
              }}
              beforeViewRemoved={(index) => {
                console.log("removed", index)
              }}
              onSelected={(cfiRange, rendition) => {
                console.log("selected", cfiRange)
                this.state.book.getRange(cfiRange).then(function(range) {
                  console.log(`Text: ${range.endContainer.data.substring(range.startOffset, range.endOffset)}`);
                });
                // Add marker
                rendition.highlight(cfiRange, {});
              }}
              onMarkClicked={(cfiRange) => {
                console.log("mark clicked", cfiRange)
              }}
              // themes={{
              //   tan: {
              //     body: {
              //       "-webkit-user-select": "none",
              //       "user-select": "none",
              //       "background-color": "tan"
              //     }
              //   }
              // }}
              // theme="tan"
              // regenerateLocations={true}
              // generateLocations={true}
              origin={this.state.origin}
              onError={(message) => {
                console.log("EPUBJS-Webview", message);
              }}
            />
            <SafeAreaView
              style={[styles.bar, { top:0 }]}>
              <TopBar
                title={this.state.title}
                shown={this.state.showBars}
                onLeftButtonPressed={() => this._nav.show()}
                onRightButtonPressed={
                  (value) => {
                    if (this.state.flow === "paginated") {
                      this.setState({flow: "scrolled-continuous"});
                    } else {
                      this.setState({flow: "paginated"});
                    }
                  }
                }
               />
            </SafeAreaView>
            <SafeAreaView
              style={[styles.bar, { bottom:0 }]}>
              <BottomBar
                disabled= {this.state.sliderDisabled}
                value={this.state.visibleLocation ? this.state.visibleLocation.start.percentage : 0}
                shown={this.state.showBars}
                onSlidingComplete={
                  (value) => {
                    this.setState({location: value.toFixed(6)})
                  }
                }/>
            </SafeAreaView>
            <SafeAreaView>
              <Nav ref={(nav) => this._nav = nav }
                display={(loc) => {
                  this.setState({ location: loc });
                }}
                toc={this.state.toc}
              />
            </SafeAreaView>
      </SafeAreaView>

    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  reader: {
    flex: 1,
    alignSelf: 'stretch',
    backgroundColor: '#3F3F3C'
  },
  bar: {
    position:"absolute",
    left:0,
    right:0,
    height:55
  }
});

export default EpubReader;
