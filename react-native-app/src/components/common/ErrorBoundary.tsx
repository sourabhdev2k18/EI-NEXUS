import React, { Component, PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../ui/Button';
import { colors, fontFamily } from '../../theme';

interface State {
  error: Error | null;
}

// The web version's "Retry" button called `window.location.reload()`, which
// doesn't exist in React Native (there's no page to reload). Instead we
// reset the boundary's own state, which unmounts/remounts the children and
// gives them a fresh chance to render.
export class ErrorBoundary extends Component<PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <View style={styles.wrap} accessibilityRole="alert">
          <Text style={styles.text}>Something went wrong while loading EI-Nexus.</Text>
          <Button variant="primary" onPress={this.handleRetry} style={styles.button}>
            Retry
          </Button>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  text: {
    color: colors.muted,
    fontFamily: fontFamily.mono,
    fontSize: 12.5,
    textAlign: 'center',
    marginBottom: 18,
  },
  button: {
    minWidth: 120,
  },
});
