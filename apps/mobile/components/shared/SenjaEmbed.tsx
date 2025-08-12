import { StyleSheet, View } from 'react-native';
import AutoHeightWebView from "react-native-autoheight-webview";
import { useState } from "react";
import { Dimensions } from "react-native";

export const SenjaEmbed = ({ id } : { id: string}) => {
  const [webViewHeight, setWebViewHeight] = useState(
    Dimensions.get("window").height
  );

  return (
    <AutoHeightWebView
      style={{
        maxHeight: webViewHeight,
        width: "100%",
      }}
      onSizeUpdated={(size) => {
        setWebViewHeight(size.height);
      }}
      showsVerticalScrollIndicator={false}
      scrollEnabled={false}
      source={{
        html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0,user-scalable=0"/>
              </head>
              <body>
                 <div class="senja-embed" data-id="${id}" data-mode="shadow" data-lazyload="false">
                 </div>
                 <script async type="text/javascript" src="https://widget.senja.io/widget/${id}/platform.js"></script>
              </body>
            </html>
          `,
      }}
    />
  );
};

// Use the widget like this

export default function App() {
  return (
    <View style={styles.container}>
      <SenjaEmbed id="YOUR-WIDGET-ID" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});