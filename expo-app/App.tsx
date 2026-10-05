import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NoteListScreen } from './src/screens/NoteListScreen';
import { NoteScreen } from './src/screens/NoteScreen';

type Route = { name: 'list' } | { name: 'note'; id: string; calendarByDefault?: boolean };

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'list' });

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {route.name === 'list' ? (
        <NoteListScreen
          onOpenNote={(id, opts) => setRoute({ name: 'note', id, ...opts })}
        />
      ) : (
        <NoteScreen
          noteId={route.id}
          calendarByDefault={route.calendarByDefault}
          onClose={() => setRoute({ name: 'list' })}
        />
      )}
    </SafeAreaProvider>
  );
}
