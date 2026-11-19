#include <msp430.h> 
#include <stdint.h>

#define FLAGS UCA1IFG // Contains the transmit & receive flags
#define RXFLAG UCRXIFG // Receive flag
#define TXFLAG UCTXIFG // Transmit flag
#define TXBUFFER UCA1TXBUF // Transmit buffer
#define RXBUFFER UCA1RXBUF // Receive buffer

#define MORSE_DOT_CYCLES 100000UL  // About 100 ms if MCLK is 1 MHz

#define BUT1 BIT1 // Button S1 at Port 1.1

volatile unsigned int received;

void initialize_Buzzer(void);
void buzzer_on(void);
void buzzer_off(void);
void morse_play_letter(char letter);
void morse_play_number(char number);
void Initialize_UART(void);
void uart_write_char(unsigned char ch);
unsigned char uart_read_char(void);
void uart_write_string (char * str);

int main(void)
{
	WDTCTL = WDTPW | WDTHOLD;	// stop watchdog timer
	PM5CTL0 &= ~LOCKLPM5; 	// Enable the GPIO pins
	
	// Configure pins to backchannel UART
	// Pins: (UCA1TXD / P3.4) (UCA1RXD / P3.5)
	// (P3SEL1=00, P3SEL0=11) (P2DIR=xx)
	P3SEL1 &= ~(BIT4|BIT5);
	P3SEL0 |= (BIT4|BIT5);

	Initialize_UART();
	initialize_Buzzer();
	
	uart_write_string("Morse Code Translator\r\n\n");
	uart_write_string("Type a message to be translated into Morse Code  (only numbers and letters):\r\n");
	uart_write_string("(Max of message is 15 characters including spaces)\r\n");

	char message[16];
	unsigned int length = 0;

	static const char * const morse_letters[] = {
		".-",    // A
		"-...",  // B
		"-.-.",  // C
		"-..",   // D
		".",    // E
		"..-.",  // F
		"--.",  // G
		"....",   // H
		"..",    // I
		".---",  // J
		"-.-",  // K
		".-..",   // L
		"--",    // M
		"-.",  // N
		"---",  // O
		".--.",   // P
		"--.-",    // Q
		".-.",  // R
		"...",  // S
		"-",   // T
		"..-",    // U
		"...-",  // V
		".--",  // W
		"-..-",   // X
		"-.--",    // Y
		"--..",  // Z
	};

	const char * const morse_numbers[]{
		"-----",    // 0
		".----",  	// 1
		"..---",  	// 2
		"...--",   	// 3
		"....-",    // 4
		".....",  	// 5
		"-....",  	// 6
		"--...",   	// 7
		"---..",    // 8
		"----.",  	// 9
	}

	for (;;) {
		unsigned char received = uart_read_char();

		if (received == '\r' || received == '\n') {
			if (length == 0) {
				continue;
			}

			message[length] = '\0';
			uart_write_string("\r\nPlaying Morse Code translation of above message\r\n");

			// Add Morse playback here while the completed message is available.
			length = 0;
		} else if (received >= ' ' && received <= '~' && length < sizeof message - 1) {
			message[length] = received;
			length++;
			uart_write_char(received);
		}
	}
}

void initialize_Buzzer(void)
{
    // Route Timer_B0 channel 6 to P2.7 (BoosterPack J4.40).
    P2DIR  |= BIT7;
    P2SEL1 &= ~BIT7;
    P2SEL0 |= BIT7;

    // Configure a 2 kHz PWM signal with a 1 MHz SMCLK.
    TB0CTL   = TBSSEL__SMCLK | MC__STOP | TBCLR;
    TB0EX0   = 0;       // No additional clock division
    TB0CCR0  = 499;     // 1,000,000 / (499 + 1) = 2,000 Hz
    TB0CCR6  = 250;     // Half of the 500-count period
    TB0CCTL6 = 0;       // Hold the output low
}

void buzzer_on(void)
{
    TB0CCTL6 = OUTMOD_7;// Reset/set PWM
    TB0CTL   = TBSSEL__SMCLK | MC__UP | TBCLR;
}

void buzzer_off(void)
{
    TB0CCTL6 = 0;      // Force the output low
    TB0CTL   = TBSSEL__SMCLK | MC__STOP | TBCLR;
}

void morse_play_pattern(const char *pattern)
{
    for (; *pattern != '\0'; pattern++) {
        buzzer_on();
        if (*pattern == '-') {
            __delay_cycles(3UL * MORSE_DOT_CYCLES);
        } else {
            __delay_cycles(MORSE_DOT_CYCLES);
        }
        buzzer_off();

        if (pattern[1] != '\0') {
            __delay_cycles(MORSE_DOT_CYCLES);
        }
    }
}

void morse_play_letter(char letter)
{
    if (letter >= 'A' && letter <= 'Z') {
        morse_play_pattern(morse_letters[letter - 'A']);
    }
}

void morse_play_number(char number)
{
    if (number >= '0' && number <= '9') {
        morse_play_pattern(morse_letters[number - '0']);
    }
}

void uart_write_string (char * str_array){
	unsigned int i;
	for(i = 0;str_array[i] != '\0';i++){
		uart_write_char(str_array[i]);
	}
}

unsigned char uart_read_char(void){
	unsigned char temp;
	// Return null character (ASCII=0) if no byte was received
	if( (FLAGS & RXFLAG) == 0)
	return 0;
	// Otherwise, copy the received byte (this clears the flag) and return it
	temp = RXBUFFER;
	return temp;
}

void uart_write_char(unsigned char ch){
	// Wait for any ongoing transmission to complete
	while ( (FLAGS & TXFLAG) == 0 ) {}
	// Copy the byte to the transmit buffer
	TXBUFFER = ch; // Tx flag goes to 0 and Tx begins!
	return;
}

void uart_write_uint16 (unsigned int n){
	unsigned int m = 0;
	char digits[5];
	// This checks if the number is 0
	if (n == 0) {
		uart_write_char('0');
		return;
	}
	
	while (n > 0) {
		// Cuts far right digit and puts into array
        digits[m] = '0' + (n % 10);
		// Goes to the next spot in array
        m++;
		// Makes n smaller ie from 4567 --> 456
        n /= 10;
    }
	// This loop prints the array backwards since it was uploaded into the array backwards
    while (m > 0) {
        m--;
        uart_write_char(digits[m]);
    }
}

// Configure UART to the popular configuration
// 9600 baud, 8-bit data, LSB first, no parity bits, 1 stop bit
// no flow control, oversampling reception
// Clock: SMCLK @ 1 MHz (1,000,000 Hz)

void Initialize_UART(void){
	// Configure pins to UART functionality
	P3SEL1 &= ~(BIT4|BIT5);
	P3SEL0 |= (BIT4|BIT5);
	// Main configuration register
	UCA1CTLW0 = UCSWRST; // Engage reset; change all the fields to zero
	// Most fields in this register, when set to zero, correspond to the
	// popular configuration
	UCA1CTLW0 |= UCSSEL_2; // Set clock to SMCLK
	// Configure the clock dividers and modulators (and enable oversampling)
	UCA1BRW = 6; // divider
	// Modulators: UCBRF = 8 = 1000 --> UCBRF3 (bit #3)
	// UCBRS = 0x20 = 0010 0000 = UCBRS5 (bit #5)
	UCA1MCTLW = UCBRF3 | UCBRS5 | UCOS16;
	// Exit the reset state
	UCA1CTLW0 &= ~UCSWRST;
}
