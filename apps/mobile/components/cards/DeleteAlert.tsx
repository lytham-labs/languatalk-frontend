import { Alert } from 'react-native';

interface DeleteAlertProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  word: string;
}

const DeleteAlert: React.FC<DeleteAlertProps> = ({
  visible,
  onClose,
  onConfirm,
  word,
}) => {
  if (visible) {
    Alert.alert(
      'Delete Vocabulary?',
      word,
      [
        {
          text: 'Cancel',
          onPress: onClose,
          style: 'cancel',
        },
        {
          text: 'Delete',
          onPress: onConfirm,
          style: 'destructive',
        },
      ],
      {
        cancelable: true,
        onDismiss: onClose,
      }
    );
  }
  return null;
};

export default DeleteAlert; 