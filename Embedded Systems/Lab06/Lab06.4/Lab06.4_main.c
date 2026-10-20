#include <msp430.h> 
#include <stdint.h>

#define redLED BIT0 // Red LED at P1.0
#define greenLED BIT7 // Green LED at P9.7
#define BUT1 BIT1 // Button S1 at Port 1.1
#define BUT2 BIT2 // Button S2 at Port 1.2

#define FLAGS UCA1IFG // Contains the transmit & receive flags
#define RXFLAG UCRXIFG // Receive flag
#define TXFLAG UCTXIFG // Transmit flag
#define TXBUFFER UCA1TXBUF // Transmit buffer
#define RXBUFFER UCA1RXBUF // Receive buffer

volatile unsigned int received, runway1_RQ, runway2_RQ;


void Initialize_UART(void);
void uart_write_char(unsigned char ch);
unsigned char uart_read_char(void);
void uart_write_string (char * str);

int main(void)
{
	WDTCTL = WDTPW | WDTHOLD; // Stop the Watchdog timer
	PM5CTL0 &= ~LOCKLPM5; 	// Enable the GPIO pins
	P1DIR |= redLED; 		// Direct pin as output
	P9DIR |= greenLED; 		// Direct pin as output
	P1OUT &= ~redLED; 		// Turn LED Off
	P9OUT &= ~greenLED; 	// Turn LED Off

	// Initialize button with interupts
	P1DIR &= ~(BUT1|BUT2); // 0: input
	P1REN |= (BUT1|BUT2);  // 1: enable built-in resistors
	P1OUT |= (BUT1|BUT2);  // 1: built-in resistor is pulled up to Vcc
	P1IES |= (BUT1|BUT2);  // 1: interrupt on falling edge (0 for rising edge)
	P1IFG &= ~(BUT1|BUT2); // 0: clear the interrupt flags

	// Configure pins to backchannel UART
	// Pins: (UCA1TXD / P3.4) (UCA1RXD / P3.5)
	// (P3SEL1=00, P3SEL0=11) (P2DIR=xx)
	P3SEL1 &= ~(BIT4|BIT5);
	P3SEL0 |= (BIT4|BIT5);
	Initialize_UART();

	uart_write_string("ORLANDO EXECUTIVE AIRPORT RUNWAY CONTROL\r\n\n\n");
	uart_write_string("                Runway 1    Runway 2\r\n");
	uart_write_string("Request (RQ):      1            3\r\n");
	uart_write_string("Forfeit (FF):      7            9\r\n");
	uart_write_string("--------                        --------\r\n");
	uart_write_string("Runway 1                        Runway 2\r\n");
	uart_write_string("--------                        --------\r\n");

	// Keep resetting P1FLG to make sure no overlap from excess buttons pressing
	for(;;){
		// Sits here waiting for input from PC
		unsigned char received = uart_read_char();
		// If 1 is pressed 
		if (received == '1'){
			uart_write_string("\033[10;1HRequested");
			P1IFG &= ~BUT1;
			P1OUT |= redLED;
			runway1_RQ = 1;
		}
		if ((P1IFG & BUT1) != 0 && runway1_RQ == 1){
			uart_write_string("\033[11;1HIn use");
			P1IFG &= ~BUT1;
        	runway1_RQ = 0;
			// While loop which waits for the Forfeit button
			while(received != '7'){
				P1IFG &= ~BUT2;
				received = uart_read_char();
				P1OUT ^= redLED;
				__delay_cycles(500000);
				// Checks for 2nd "Hurry Up" button press
				if((P1IFG & BUT1) != 0){
					P1IFG &= ~BUT1;
					uart_write_string("\033[13;1H*** Inquiry ***");
				}
			}
			// Clears all the words
			P1IFG &= ~BUT2;
			P1OUT &= ~redLED;
			uart_write_string("\033[10;1H         ");
			uart_write_string("\033[11;1H      ");
			uart_write_string("\033[13;1H               ");
		}
		if (received == '3'){
			uart_write_string("\033[10;33HRequested");
			P1IFG &= ~BUT2;
			P9OUT |= greenLED;
			runway2_RQ = 1;
		}
		if ((P1IFG & BUT2) != 0 && runway2_RQ == 1){
			uart_write_string("\033[11;33HIn use");
			P1IFG &= ~BUT2;
        	runway2_RQ = 0;
			// While loop which waits for the Forfeit button
        	while(received != '9'){
				P1IFG &= ~BUT1;
				received = uart_read_char();
				P9OUT ^= greenLED;
				__delay_cycles(500000);
				// Checks for 2nd "Hurry Up" button press
				if((P1IFG & BUT2) != 0){
					P1IFG &= ~BUT2;
					uart_write_string("\033[13;33H*** Inquiry ***");
				}
			}
			// Clears all the words
			P1IFG &= ~BUT1;
			P9OUT &= ~greenLED;
			uart_write_string("\033[10;33H         ");
			uart_write_string("\033[11;33H      ");
			uart_write_string("\033[13;33H               ");
		}
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
